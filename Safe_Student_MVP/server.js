const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword, verifyPassword, randomToken } = require('./lib/security');
const {
  normalizeToken,
  canRegisterAttendance,
  canManageSchool,
  canViewAudit,
  allowedStudentIds,
  validateAttendanceSequence,
  attendanceRate,
  canMessageRole,
  movementState,
} = require('./lib/domain');

const PORT = Number(process.env.PORT || 3000);
const SEED_DB_PATH = path.join(__dirname, 'data', 'db.seed.json');
const DB_PATH = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.runtime.json');
const PUBLIC = path.join(__dirname, 'public');
const TIME_ZONE = process.env.SS_TIME_ZONE || 'America/Sao_Paulo';
const SESSION_TTL_MS = Number(process.env.SS_SESSION_TTL_MS || 2 * 60 * 60 * 1000);
const MAX_BODY_BYTES = 1_000_000;
const sessions = new Map();
const loginAttempts = new Map();
const passwordResets = new Map();

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) fs.copyFileSync(SEED_DB_PATH, DB_PATH);
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  const tmp = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function csv(res, filename, rows) {
  const esc = (v) => {
    const raw = String(v ?? '');
    // Prefixar valores perigosos de células CSV para que planilhas não interpretem texto como fórmula.
    const safe = /^[\s\x00-\x1f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const body = rows.map((r) => r.map(esc).join(';')).join('\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.end(`\ufeff${body}`);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        settled = true;
        reject(new Error('Corpo da requisição excede 1 MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', (err) => {
      if (!settled) reject(err);
    });
  });
}

function safeUser(user) {
  const u = { ...user };
  delete u.passwordHash;
  return u;
}

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function normalizeCpf(value) { return String(value || '').replace(/\D/g, ''); }
function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // sequências como 111.111.111-11 passam no dígito, mas nunca são reais
  const d = cpf.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += d[i] * (10 - i);
  let r = sum % 11;
  const dv1 = r < 2 ? 0 : 11 - r;
  if (dv1 !== d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += d[i] * (11 - i);
  r = sum % 11;
  const dv2 = r < 2 ? 0 : 11 - r;
  return dv2 === d[10];
}
function maskCpf(cpf) { return cpf && cpf.length === 11 ? `***.***.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}` : ''; }
function digestCode(value) { return crypto.createHash('sha256').update(String(value).trim().toUpperCase()).digest('hex'); }
function validPerson(value) { return value.length >= 3 && value.length <= 120 && !/[<>]/.test(value); }
function guardianInvitationView(invitation) {
  return { id: invitation.id, name: invitation.name, email: invitation.email,
    phone: invitation.phone, relationship: invitation.relationship, cpfMasked: maskCpf(invitation.cpf),
    studentIds: invitation.studentIds, expiresAt: invitation.expiresAt, status: invitation.status };
}
function issueGuardianInvitation(db, guardian, studentId) {
  db.guardianInvitations ||= [];
  const old = db.guardianInvitations.find(i => i.email === guardian.email && i.status === 'PENDENTE');
  const code = crypto.randomBytes(12).toString('hex').toUpperCase();
  const invitation = old || { id: crypto.randomUUID(), email: guardian.email, studentIds: [], status: 'PENDENTE' };
  Object.assign(invitation, { name: guardian.name, phone: guardian.phone,
    relationship: guardian.relationship, cpf: guardian.cpf || invitation.cpf || '', codeHash: digestCode(code),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
  invitation.studentIds = [...new Set([...invitation.studentIds, studentId])];
  if (!old) db.guardianInvitations.push(invitation);
  return { invitation: guardianInvitationView(invitation), activationCode: code };
}

function directoryUser(user) {
  return { id: user.id, name: user.name, role: user.role, status: user.status };
}

function studentView(user, db, student, { includeGuardians = false } = {}) {
  const view = {
    id: student.id,
    name: student.name,
    enrollment: student.enrollment,
    classId: student.classId,
    className: className(db, student.classId),
    status: student.status,
  };
  if (canRegisterAttendance(user.role)) view.token = student.token;
  if (includeGuardians) {
    view.guardians = canManageSchool(user.role)
      ? [
        ...db.users.filter((u) => u.role === 'RESPONSAVEL' && (u.studentIds || []).includes(student.id))
          .map((u) => ({ id: u.id, name: u.name, status: 'ATIVO' })),
        ...(db.guardianInvitations || []).filter(i => i.status === 'PENDENTE' && i.studentIds.includes(student.id))
          .map(i => ({ id: i.id, name: i.name, status: 'CONVITE_PENDENTE' })),
      ] : [];
  }
  return view;
}

function feedbackView(feedback) {
  const { userId: _legacyUserId, ...anonymous } = feedback;
  return anonymous;
}

function uniqueStudentToken(db) {
  for (let i = 0; i < 32; i += 1) {
    const token = `SS-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    if (!db.students.some((s) => s.token === token)) return token;
  }
  throw new Error('Não foi possível gerar token único para o aluno.');
}

function audit(db, userId, action, entity = '', entityId = '', details = '') {
  db.audit = db.audit || [];
  db.audit.push({
    id: crypto.randomUUID(),
    userId,
    action,
    entity,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  });
}

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

function bearerToken(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function sessionTokenFromReq(req) {
  return bearerToken(req) || cookieValue(req, 'ss_session');
}

function setSessionCookie(res, token, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  const secure = process.env.SS_SECURE_COOKIE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ss_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.SS_SECURE_COOKIE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ss_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function userFromReq(req, db) {
  const token = sessionTokenFromReq(req);
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  // Revalidar o usuário em cada requisição: permissões e vínculos podem mudar
  // depois do login. Uma sessão desatualizada não pode conservar acesso revogado ou vínculos antigos.
  const current = db.users.find((item) => item.id === session.user.id && item.status === 'ATIVO');
  if (!current) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  session.user = safeUser(current);
  return session.user;
}

function roleNameForServer(role) {
  return {
    RESPONSAVEL: 'Responsável',
    PORTARIA: 'Portaria',
    GESTAO: 'Gestão',
    ADMIN: 'Administrador',
  }[role] || role;
}

function className(db, classId) {
  const item = db.classes.find((c) => c.id === classId);
  return item ? `${item.name} - ${item.shift}` : 'Sem turma';
}

function studentById(db, id) {
  return db.students.find((s) => s.id === id);
}

function userById(db, id) {
  return db.users.find((u) => u.id === id);
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatSchoolDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function validIsoDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function reportFilters(url, db, res) {
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const classId = url.searchParams.get('classId') || '';
  const studentId = url.searchParams.get('studentId') || '';
  const type = String(url.searchParams.get('type') || '').toUpperCase();
  if (!validIsoDate(from) || !validIsoDate(to) || (from && to && from > to) ||
    (classId && !db.classes.some((item) => item.id === classId)) ||
    (studentId && !db.students.some((item) => item.id === studentId)) ||
    (type && !['ENTRADA', 'SAIDA'].includes(type))) {
    json(res, 400, { error: 'Filtros inválidos: confira período, turma, aluno e tipo de movimentação.' });
    return null;
  }
  return {
    from,
    to,
    classId,
    studentId,
    type,
    inRange(timestamp) {
      const key = dateKey(timestamp);
      return (!from || key >= from) && (!to || key <= to);
    },
  };
}

function attendanceStatusForStudent(db, student) {
  const today = dateKey();
  const records = (db.attendance || []).filter((record) => record.studentId === student.id && dateKey(record.timestamp) === today);
  return movementState(records);
}

function visibleNotifications(user, db) {
  const allowed = new Set(allowedStudentIds(user, db));
  return (db.notifications || [])
    .filter((notification) => notification.userId === user.id && (!notification.studentId || allowed.has(notification.studentId)))
    .map((notification) => ({ ...notification, student: studentById(db, notification.studentId)?.name || 'Aluno' }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildReportData(user, db, filters) {
  const allowed = new Set(allowedStudentIds(user, db));
  const students = db.students.filter((student) => allowed.has(student.id) &&
    (!filters.classId || student.classId === filters.classId) &&
    (!filters.studentId || student.id === filters.studentId));
  const studentIds = new Set(students.map((student) => student.id));
  const records = (db.attendance || [])
    .filter((record) => studentIds.has(record.studentId) && filters.inRange(record.timestamp) && (!filters.type || record.type === filters.type))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((record) => {
      const student = studentById(db, record.studentId);
      return {
        id: record.id,
        studentId: record.studentId,
        name: student?.name || 'Aluno',
        enrollment: student?.enrollment || '',
        className: className(db, student?.classId),
        type: record.type,
        timestamp: record.timestamp,
        method: record.method,
        registeredBy: userById(db, record.registeredBy)?.name || 'Sistema',
      };
    });
  const summary = students.map((student) => {
    const own = records.filter((record) => record.studentId === student.id);
    return {
      studentId: student.id,
      name: student.name,
      enrollment: student.enrollment,
      className: className(db, student.classId),
      entradas: own.filter((record) => record.type === 'ENTRADA').length,
      saidas: own.filter((record) => record.type === 'SAIDA').length,
      ultimoRegistro: own[0]?.timestamp || null,
    };
  });
  return { records, summary };
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
}

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.resolve(PUBLIC, `.${urlPath}`);
  if (filePath !== PUBLIC && !filePath.startsWith(`${PUBLIC}${path.sep}`)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
    };
    securityHeaders(res);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
    res.end(data);
  });
}

function rateLimited(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter((time) => now - time < 60_000);
  loginAttempts.set(ip, attempts);
  return attempts.length >= 10;
}

function recordLoginAttempt(ip) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function canMessageUser(from, to) {
  if (!from || !to || from.id === to.id || to.status !== 'ATIVO') return false;
  return canMessageRole(from.role, to.role);
}

function visibleDirectory(user, db) {
  return db.users.filter((u) => canMessageUser(user, u)).map(directoryUser);
}

function scopedStudents(user, db) {
  if (canManageSchool(user.role)) return db.students;
  const ids = new Set(allowedStudentIds(user, db));
  return db.students.filter((s) => ids.has(s.id));
}

async function handler(req, res) {
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    let db = readDb();

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        version: '2.1.0',
        mode: 'academic-demo',
        timeZone: TIME_ZONE,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/password/forgot') {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email);
      if (!validEmail(email)) return json(res, 400, { error: 'Informe um e-mail válido.' });
      const account = db.users.find((item) => normalizeEmail(item.email) === email && item.status === 'ATIVO');
      const response = { ok: true, message: 'Se o e-mail estiver cadastrado, um código de redefinição foi gerado.' };
      if (account) {
        const code = String(crypto.randomInt(100000, 1000000));
        passwordResets.set(email, { userId: account.id, codeHash: digestCode(code), expiresAt: Date.now() + 15 * 60 * 1000 });
        // O MVP não possui serviço de envio de e-mail. Retornar o código é intencional no ambiente de demonstração.
        response.demoCode = code;
      }
      return json(res, 200, response);
    }

    if (req.method === 'POST' && url.pathname === '/api/password/reset') {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email);
      const code = String(body.code || '').trim();
      const password = String(body.password || '');
      const confirmation = String(body.confirmPassword || '');
      const reset = passwordResets.get(email);
      if (!reset || reset.expiresAt < Date.now() || reset.codeHash !== digestCode(code)) {
        return json(res, 400, { error: 'Código inválido ou expirado. Solicite uma nova redefinição.' });
      }
      if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || password !== confirmation) {
        return json(res, 400, { error: 'Informe uma senha de 10 a 128 caracteres, com letras e números, e confirme corretamente.' });
      }
      db = readDb();
      const account = db.users.find((item) => item.id === reset.userId && item.status === 'ATIVO');
      if (!account) return json(res, 404, { error: 'Conta não encontrada ou inativa.' });
      account.passwordHash = hashPassword(password);
      audit(db, account.id, 'REDEFINIR_SENHA', 'usuario', account.id, 'Redefinição por código temporário');
      writeDb(db);
      passwordResets.delete(email);
      for (const [token, session] of sessions) if (session.user.id === account.id) sessions.delete(token);
      return json(res, 200, { ok: true, message: 'Senha redefinida. Entre novamente com a nova senha.' });
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const ip = req.socket.remoteAddress || 'local';
      if (rateLimited(ip)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const user = db.users.find((u) => u.email.toLowerCase() === email && u.status === 'ATIVO');
      if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) {
        recordLoginAttempt(ip);
        return json(res, 401, { error: 'Credenciais inválidas.' });
      }
      clearLoginAttempts(ip);
      const token = randomToken();
      user.lastLoginAt = new Date().toISOString();
      const sanitized = safeUser(user);
      sessions.set(token, { user: sanitized, expiresAt: Date.now() + SESSION_TTL_MS });
      audit(db, user.id, 'LOGIN', 'sessao', '', `Perfil ${user.role}`);
      writeDb(db);
      setSessionCookie(res, token);
      return json(res, 200, { token, user: sanitized, expiresInSeconds: SESSION_TTL_MS / 1000 });
    }

    if (req.method === 'POST' && url.pathname === '/api/guardian/register') {
      const ip = req.socket.remoteAddress || 'local';
      if (rateLimited(ip)) return json(res, 429, { error: 'Muitas tentativas. Tente novamente em um minuto.' });
      recordLoginAttempt(ip);
      const body = await parseBody(req);
      db = readDb();
      const email = normalizeEmail(body.email);
      const code = String(body.code || '').trim().toUpperCase();
      const password = String(body.password || '');
      const confirmation = String(body.confirmPassword || '');
      const cpf = normalizeCpf(body.cpf);
      if (cpf && !validCpf(cpf)) return json(res, 400, { error: 'CPF inválido. Deixe o campo em branco se preferir não informar.' });
      if (cpf && db.users.some(u => u.cpf === cpf)) return json(res, 409, { error: 'Este CPF já está associado a outra conta. Entre com sua senha ou contate a escola.' });
      const invitation = (db.guardianInvitations || []).find(i => i.email === email &&
        i.status === 'PENDENTE' && i.codeHash === digestCode(code) && new Date(i.expiresAt).getTime() > Date.now());
      if (!invitation) return json(res, 400, { error: 'Convite inválido ou expirado. Solicite um novo código à escola.' });
      if (db.users.some(u => normalizeEmail(u.email) === email)) return json(res, 409, { error: 'Esta conta já existe. Entre com sua senha e solicite à escola a vinculação, se necessário.' });
      if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || password !== confirmation) {
        return json(res, 400, { error: 'Informe uma senha de 10 a 128 caracteres, com letras e números, e confirme corretamente.' });
      }
      const studentIds = [...new Set(invitation.studentIds)].filter(id => db.students.some(s => s.id === id && s.status === 'ATIVO'));
      if (!studentIds.length) return json(res, 409, { error: 'O convite não possui aluno ativo. Contate a escola.' });
      const account = { id: crypto.randomUUID(), name: invitation.name, email, phone: invitation.phone,
        cpf: cpf || invitation.cpf || '', passwordHash: hashPassword(password), role: 'RESPONSAVEL', studentIds, status: 'ATIVO', lastLoginAt: new Date().toISOString() };
      db.users.push(account);
      clearLoginAttempts(ip);
      invitation.status = 'UTILIZADO';
      invitation.codeHash = null;
      // Convites adicionais para o mesmo e-mail aprovado são incorporados à conta ativada.
      for (const pending of db.guardianInvitations || []) {
        if (pending.email !== email || pending.status !== 'PENDENTE') continue;
        account.studentIds = [...new Set([...account.studentIds, ...pending.studentIds.filter(id => db.students.some(s => s.id === id && s.status === 'ATIVO'))])];
        pending.status = 'UTILIZADO'; pending.codeHash = null;
      }
      audit(db, account.id, 'ATIVAR_RESPONSAVEL', 'usuario', account.id, `Vínculos aprovados: ${account.studentIds.length}`);
      writeDb(db);
      const token = randomToken();
      const sanitized = safeUser(account);
      sessions.set(token, { user: sanitized, expiresAt: Date.now() + SESSION_TTL_MS });
      setSessionCookie(res, token);
      return json(res, 201, { token, user: sanitized, childrenLinked: account.studentIds.length });
    }

    const user = userFromReq(req, db);
    if (!user) return json(res, 401, { error: 'Sessão expirada ou ausente.' });

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      sessions.delete(sessionTokenFromReq(req));
      audit(db, user.id, 'LOGOUT');
      writeDb(db);
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      return json(res, 200, { user });
    }

    if (req.method === 'GET' && url.pathname === '/api/search') {
      const term = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase('pt-BR');
      if (term.length < 2) return json(res, 200, { students: [], guardians: [], records: [], messages: [] });
      const allowed = new Set(allowedStudentIds(user, db));
      const students = db.students.filter((student) => allowed.has(student.id) && [student.name, student.enrollment, student.token, className(db, student.classId)].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term))).slice(0, 8).map((student) => ({ id: student.id, name: student.name, enrollment: student.enrollment, className: className(db, student.classId), view: 'students' }));
      const guardians = canManageSchool(user.role) ? db.users.filter((candidate) => candidate.role === 'RESPONSAVEL' && [candidate.name, candidate.email, candidate.phone].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term))).slice(0, 6).map((candidate) => ({ id: candidate.id, name: candidate.name, email: candidate.email, view: 'guardians' })) : [];
      const records = db.attendance.filter((record) => allowed.has(record.studentId) && [record.type, studentById(db, record.studentId)?.name].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term))).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6).map((record) => ({ id: record.id, title: `${record.type === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada`, description: studentById(db, record.studentId)?.name || 'Aluno', createdAt: record.timestamp, view: 'reports' }));
      const messages = (db.messages || []).filter((message) => (message.fromUserId === user.id || message.toUserId === user.id) && String(message.text || '').toLocaleLowerCase('pt-BR').includes(term)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((message) => ({ id: message.id, title: 'Mensagem', description: message.text, createdAt: message.createdAt, view: 'messages' }));
      return json(res, 200, { students, guardians, records, messages });
    }

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const ids = allowedStudentIds(user, db);
      const allowed = new Set(ids);
      const students = scopedStudents(user, db).map((s) => studentView(user, db, s));
      const attendance = db.attendance
        .filter((r) => allowed.has(r.studentId))
        .map((r) => ({ ...r, student: studentById(db, r.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const notifications = visibleNotifications(user, db);
      const today = dateKey();
      const todayAtt = db.attendance
        .filter((r) => dateKey(r.timestamp) === today && allowed.has(r.studentId))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      // Somente o evento mais recente é exibido; um registro não prova localização em tempo real.
      const latestToday = new Map();
      todayAtt.forEach((record) => latestToday.set(record.studentId, record));
      const studentStatuses = students.map((student) => {
        const last = latestToday.get(student.id);
        const status = movementState(last ? [last] : []);
        return {
          id: student.id,
          name: student.name,
          className: student.className,
          lastType: last?.type || null,
          lastTimestamp: last?.timestamp || null,
          state: status.state,
          stateLabel: status.label,
          nextType: status.nextType,
        };
      });
      // Os agregados devem ser calculados no servidor, *depois* da aplicação do escopo de alunos.
      // São movimentações, NÃO frequência em sala nem prova de localização física.
      const weeklyMovements = Array.from({ length: 7 }, (_, index) => {
        const day = new Date();
        day.setUTCDate(day.getUTCDate() - (6 - index));
        const dayKey = dateKey(day);
        const records = db.attendance.filter((r) => allowed.has(r.studentId) && dateKey(r.timestamp) === dayKey);
        return {
          date: dayKey,
          entradas: records.filter((r) => r.type === 'ENTRADA').length,
          saidas: records.filter((r) => r.type === 'SAIDA').length,
        };
      });
      const byClass = new Map();
      studentStatuses.forEach((student) => {
        const key = student.className;
        if (!byClass.has(key)) byClass.set(key, { name: key, students: 0, entradas: 0, entradasSemSaida: 0, saidas: 0, semRegistro: 0, ultimoRegistro: null });
        const row = byClass.get(key);
        row.students += 1;
        if (student.lastType === 'ENTRADA') { row.entradas += 1; row.entradasSemSaida += 1; }
        else if (student.lastType === 'SAIDA') row.saidas += 1;
        else row.semRegistro += 1;
        if (student.lastTimestamp && (!row.ultimoRegistro || student.lastTimestamp > row.ultimoRegistro)) row.ultimoRegistro = student.lastTimestamp;
      });
      const recentMessages = (db.messages || [])
        .filter((message) => message.fromUserId === user.id || message.toUserId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4)
        .map((message) => ({
          id: message.id,
          text: message.text,
          createdAt: message.createdAt,
          fromName: userById(db, message.fromUserId)?.name || 'Escola',
          toName: userById(db, message.toUserId)?.name || 'Escola',
          ownMessage: message.fromUserId === user.id,
        }));
      const pendingInvitationRows = canManageSchool(user.role)
        ? (db.guardianInvitations || []).filter((invitation) => invitation.status === 'PENDENTE') : [];
      const pendingInvitations = pendingInvitationRows.length;
      const expiringInvitations = pendingInvitationRows.filter((invitation) => {
        const remaining = new Date(invitation.expiresAt).getTime() - Date.now();
        return remaining > 0 && remaining <= 7 * 86400000;
      }).length;
      const unlinkedStudents = canManageSchool(user.role)
        ? students.filter((student) => !db.users.some((candidate) => candidate.role === 'RESPONSAVEL' && candidate.status === 'ATIVO' && (candidate.studentIds || []).includes(student.id)) && !(db.guardianInvitations || []).some((invitation) => invitation.status === 'PENDENTE' && invitation.studentIds.includes(student.id))).length : 0;
      const attention = [];
      if (Array.from(latestToday.values()).filter((record) => record.type === 'ENTRADA').length) {
        attention.push({ type: 'warning', label: 'Entradas sem saída', count: Array.from(latestToday.values()).filter((record) => record.type === 'ENTRADA').length, description: 'Registros que precisam de conferência', view: 'students', action: 'Ver alunos' });
      }
      if (pendingInvitations) attention.push({ type: 'info', label: 'Convites pendentes', count: pendingInvitations, description: 'Responsáveis aguardando ativação', view: 'guardians', action: 'Revisar convites' });
      if (expiringInvitations) attention.push({ type: 'warning', label: 'Convites próximos de expirar', count: expiringInvitations, description: 'Expiram nos próximos 7 dias', view: 'guardians', action: 'Revisar validade' });
      if (unlinkedStudents) attention.push({ type: 'warning', label: 'Alunos sem responsável', count: unlinkedStudents, description: 'Cadastros que exigem revisão', view: 'students', action: 'Resolver agora' });
      if (notifications.filter((notification) => !notification.read).length) attention.push({ type: 'info', label: 'Notificações não lidas', count: notifications.filter((notification) => !notification.read).length, description: 'Avisos disponíveis para sua conta', view: 'notifications', action: 'Ver notificações' });
      if (!attention.length) attention.push({ type: 'ok', label: 'Nenhuma pendência crítica', count: 0, description: 'A rotina está em dia neste momento', view: 'dashboard', action: 'Continuar acompanhamento' });
      const timeline = [
        ...attendance.slice(0, 8).map((record) => ({ type: record.type === 'ENTRADA' ? 'entrada' : 'saida', title: `${record.type === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada`, description: record.student, createdAt: record.timestamp, view: 'presence' })),
        ...notifications.slice(0, 5).map((notification) => ({ type: 'notificacao', title: notification.title, description: notification.student, createdAt: notification.createdAt, view: 'notifications' })),
        ...recentMessages.slice(0, 5).map((message) => ({ type: 'mensagem', title: 'Mensagem recente', description: message.ownMessage ? `Para ${message.toName}` : `De ${message.fromName}`, createdAt: message.createdAt, view: 'messages' })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
      return json(res, 200, {
        school: { ...db.school, timeZone: db.school?.timeZone || TIME_ZONE },
        students,
        studentStatuses,
        weeklyMovements,
        classOverview: [...byClass.values()].map(({ name, students, entradasSemSaida, saidas, semRegistro }) => ({ name, students, entradasSemSaida, saidas, semRegistro })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        classOperational: [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        attention,
        timeline,
        operations: { pendingInvitations, expiringInvitations, unlinkedStudents },
        recentMessages,
        attendance: attendance.slice(0, 60),
        notifications: notifications.slice(0, 30),
        metrics: {
          students: students.length,
          entradasHoje: todayAtt.filter((r) => r.type === 'ENTRADA').length,
          saidasHoje: todayAtt.filter((r) => r.type === 'SAIDA').length,
          semSaidaHoje: Array.from(latestToday.values()).filter((r) => r.type === 'ENTRADA').length,
          dentroHoje: studentStatuses.filter((student) => student.state === 'DENTRO').length,
          foraHoje: studentStatuses.filter((student) => student.state === 'FORA').length,
          semRegistroHoje: studentStatuses.filter((student) => student.state === 'SEM_REGISTRO').length,
          notificacoesNaoLidas: notifications.filter((n) => !n.read).length,
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/students') {
      const result = scopedStudents(user, db).map((s) => studentView(user, db, s, { includeGuardians: true }));
      return json(res, 200, { students: result });
    }

    if (req.method === 'POST' && url.pathname === '/api/students') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para cadastrar aluno.' });
      const body = await parseBody(req);
      db = readDb();
      const name = String(body.name || '').trim();
      const enrollment = String(body.enrollment || '').trim();
      const classId = String(body.classId || '').trim();
      if (!validPerson(name) || enrollment.length < 3 || enrollment.length > 40 || !db.classes.some((item) => item.id === classId)) {
        return json(res, 400, { error: 'Nome, matrícula e turma válidos são obrigatórios.' });
      }
      if (db.students.some((student) => student.enrollment.toLowerCase() === enrollment.toLowerCase())) {
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      }

      let guardianSpecs = Array.isArray(body.guardians) ? body.guardians : [];
      // Compatibilidade com o contrato anterior de um único responsável.
      if (!guardianSpecs.length && body.guardianId) guardianSpecs = [{ mode: 'existing', guardianId: body.guardianId }];
      if (!guardianSpecs.length && body.guardian) guardianSpecs = [{ mode: 'new', ...body.guardian }];
      if (!guardianSpecs.length) return json(res, 400, { error: 'Cadastre ou selecione pelo menos um responsável para o aluno.' });
      if (guardianSpecs.length > 10) return json(res, 400, { error: 'Revise a lista de responsáveis antes de concluir o cadastro.' });

      const resolved = [];
      const seen = new Set();
      for (const raw of guardianSpecs) {
        const mode = raw?.mode === 'existing' || raw?.guardianId ? 'existing' : 'new';
        if (mode === 'existing') {
          const account = db.users.find((candidate) => candidate.id === raw.guardianId && candidate.role === 'RESPONSAVEL' && candidate.status === 'ATIVO');
          if (!account) return json(res, 404, { error: 'Um dos responsáveis selecionados não foi encontrado ou está sem acesso ativo.' });
          const key = `user:${account.id}`;
          if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'account', account }); }
          continue;
        }

        const guardian = {
          name: String(raw?.name || '').trim(),
          email: normalizeEmail(raw?.email),
          phone: String(raw?.phone || '').replace(/[^0-9+() -]/g, '').trim(),
          relationship: String(raw?.relationship || '').trim(),
          cpf: normalizeCpf(raw?.cpf),
        };
        if (!validPerson(guardian.name) || !validEmail(guardian.email) ||
          guardian.phone.replace(/\D/g, '').length < 10 || guardian.phone.replace(/\D/g, '').length > 13 ||
          !['Mãe', 'Pai', 'Responsável legal', 'Outro'].includes(guardian.relationship)) {
          return json(res, 400, { error: `Confira os dados do responsável ${guardian.name || 'informado'}: nome, e-mail, telefone e vínculo são obrigatórios.` });
        }
        if (guardian.cpf && !validCpf(guardian.cpf)) return json(res, 400, { error: `CPF inválido para ${guardian.name}.` });
        if (db.users.some((candidate) => normalizeEmail(candidate.email) === guardian.email && candidate.role !== 'RESPONSAVEL')) {
          return json(res, 409, { error: `O e-mail ${guardian.email} pertence a outro perfil. Solicite conferência à gestão.` });
        }
        if (guardian.cpf && db.users.some((candidate) => candidate.cpf === guardian.cpf && candidate.role !== 'RESPONSAVEL')) {
          return json(res, 409, { error: `O CPF informado para ${guardian.name} pertence a outro perfil.` });
        }
        const matched = db.users.find((candidate) => candidate.role === 'RESPONSAVEL' && candidate.status === 'ATIVO' &&
          ((guardian.email && normalizeEmail(candidate.email) === guardian.email) || (guardian.cpf && candidate.cpf && candidate.cpf === guardian.cpf)));
        if (matched) {
          if (guardian.name.toLocaleLowerCase('pt-BR') !== matched.name.toLocaleLowerCase('pt-BR')) {
            return json(res, 409, { error: `O e-mail ou CPF informado para o nome ${guardian.name} já pertence ao responsável ${matched.name}. Confira a identidade antes de vincular.` });
          }
          const key = `user:${matched.id}`;
          if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'account', account: matched }); }
          continue;
        }
        const pending = (db.guardianInvitations || []).find((invitation) => invitation.status === 'PENDENTE' &&
          (invitation.email === guardian.email || (guardian.cpf && invitation.cpf === guardian.cpf)));
        if (pending && pending.name.toLocaleLowerCase('pt-BR') !== guardian.name.toLocaleLowerCase('pt-BR')) {
          return json(res, 409, { error: `Já existe convite pendente com os mesmos dados de identificação para ${pending.name}. Revise antes de continuar.` });
        }
        const key = guardian.cpf ? `cpf:${guardian.cpf}` : `email:${guardian.email}`;
        if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'invite', guardian }); }
      }
      if (!resolved.length) return json(res, 400, { error: 'Nenhum responsável válido foi informado.' });

      const student = { id: crypto.randomUUID(), name, enrollment, classId, token: uniqueStudentToken(db), status: 'ATIVO' };
      db.students.push(student);
      const invitations = [];
      let linkedCount = 0;
      for (const item of resolved) {
        if (item.kind === 'account') {
          item.account.studentIds = [...new Set([...(item.account.studentIds || []), student.id])];
          linkedCount += 1;
          audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, item.account.name);
        } else {
          const invitation = issueGuardianInvitation(db, item.guardian, student.id);
          invitations.push(invitation);
          audit(db, user.id, 'CONVIDAR_RESPONSAVEL', 'aluno', student.id, item.guardian.name);
        }
      }
      audit(db, user.id, 'CADASTRAR_ALUNO', 'aluno', student.id, `${name}; responsáveis: ${resolved.length}`);
      writeDb(db); // Matrícula e todos os vínculos/convites validados são persistidos juntos.
      return json(res, 201, {
        student: studentView(user, db, student, { includeGuardians: true }),
        invitations,
        invitation: invitations[0] || null,
        guardianLinkedCount: linkedCount,
        guardianLinked: linkedCount > 0,
      });
    }

    if (req.method === 'PATCH' && /^\/api\/students\/[^/]+$/.test(url.pathname)) {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      const body = await parseBody(req);
      db = readDb();
      const student = db.students.find(s => s.id === url.pathname.split('/').pop());
      if (!student) return json(res, 404, { error: 'Aluno não encontrado.' });
      const name = String(body.name || '').trim();
      const enrollment = String(body.enrollment || '').trim();
      const classId = String(body.classId || '').trim();
      if (!validPerson(name) || enrollment.length < 3 || enrollment.length > 40 || !db.classes.some(c => c.id === classId) ||
        !['ATIVO','INATIVO'].includes(body.status)) return json(res, 400, { error: 'Dados de atualização inválidos.' });
      if (db.students.some(s => s.id !== student.id && s.enrollment.toLowerCase() === enrollment.toLowerCase()))
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      Object.assign(student, { name, enrollment, classId, status: body.status });
      audit(db, user.id, 'ATUALIZAR_ALUNO', 'aluno', student.id, `Situação ${student.status}`);
      writeDb(db);
      return json(res, 200, { student: studentView(user, db, student, { includeGuardians: true }) });
    }

    if (req.method === 'POST' && url.pathname === '/api/links') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para vincular responsável.' });
      const body = await parseBody(req);
      db = readDb();
      const guardian = db.users.find((u) => u.id === body.guardianId && u.role === 'RESPONSAVEL' && u.status === 'ATIVO');
      const student = db.students.find((s) => s.id === body.studentId && s.status === 'ATIVO');
      if (!guardian || !student) return json(res, 404, { error: 'Responsável ou aluno ativo não encontrado.' });
      guardian.studentIds = Array.from(new Set([...(guardian.studentIds || []), student.id]));
      audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, guardian.name);
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && url.pathname === '/api/links') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      const body = await parseBody(req);
      db = readDb();
      const guardian = db.users.find(u => u.id === body.guardianId && u.role === 'RESPONSAVEL');
      const student = db.students.find(s => s.id === body.studentId);
      if (!guardian || !student || !(guardian.studentIds || []).includes(student.id)) return json(res, 404, { error: 'Vínculo não encontrado.' });
      guardian.studentIds = guardian.studentIds.filter(id => id !== student.id);
      audit(db, user.id, 'REMOVER_VINCULO', 'aluno', student.id, guardian.id);
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/attendance/status') {
      if (!canRegisterAttendance(user.role)) return json(res, 403, { error: 'Perfil sem permissão para consultar a operação de portaria.' });
      const tokenCode = normalizeToken(url.searchParams.get('token'));
      const studentId = String(url.searchParams.get('studentId') || '').trim();
      const student = db.students.find((candidate) => candidate.status === 'ATIVO' &&
        ((studentId && candidate.id === studentId) || (tokenCode && candidate.token === tokenCode)));
      if (!student) return json(res, 404, { error: 'Aluno ativo não encontrado.' });
      const status = attendanceStatusForStudent(db, student);
      return json(res, 200, {
        student: studentView(user, db, student, { includeGuardians: canManageSchool(user.role) }),
        status: { state: status.state, label: status.label, nextType: status.nextType, lastType: status.last?.type || null, lastTimestamp: status.last?.timestamp || null },
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/attendance') {
      if (!canRegisterAttendance(user.role)) return json(res, 403, { error: 'Perfil sem permissão para registrar presença.' });
      const body = await parseBody(req);
      db = readDb();
      const type = String(body.type || '').toUpperCase();
      const tokenCode = normalizeToken(body.token);
      if (!['ENTRADA', 'SAIDA'].includes(type)) return json(res, 400, { error: 'Tipo de registro inválido.' });
      const student = db.students.find((s) => s.token === tokenCode && s.status === 'ATIVO');
      if (!student) return json(res, 404, { error: 'Token não encontrado ou aluno inativo.' });
      const today = dateKey();
      const todayRecords = db.attendance.filter((r) => r.studentId === student.id && dateKey(r.timestamp) === today);
      const sequence = validateAttendanceSequence(todayRecords, type);
      if (!sequence.ok) return json(res, 409, { error: sequence.error });

      const now = new Date();
      const requestedMethod = String(body.method || 'TOKEN_MANUAL').toUpperCase();
      const method = ['TOKEN_MANUAL', 'QR_CAMERA', 'QR_TOKEN'].includes(requestedMethod) ? requestedMethod : 'TOKEN_MANUAL';
      const record = {
        id: crypto.randomUUID(),
        studentId: student.id,
        type,
        method,
        timestamp: now.toISOString(),
        registeredBy: user.id,
        origin: 'PORTARIA_DEMO',
      };
      db.attendance.push(record);
      db.notifications = db.notifications || [];
      const guardians = db.users.filter((u) => u.role === 'RESPONSAVEL' && u.status === 'ATIVO' && (u.studentIds || []).includes(student.id));
      guardians.forEach((guardian) => db.notifications.push({
        id: crypto.randomUUID(),
        userId: guardian.id,
        studentId: student.id,
        title: `${type === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada`,
        message: `${student.name}: ${type.toLowerCase()} registrada no Safe Student em ${formatSchoolDateTime(now)}.`,
        createdAt: now.toISOString(),
        read: false,
        severity: 'INFO',
      }));
      audit(db, user.id, `REGISTRAR_${type}`, 'presenca', record.id, student.name);
      writeDb(db);
      const updatedStatus = attendanceStatusForStudent(db, student);
      return json(res, 201, { record, student: studentView(user, db, student), notified: guardians.length,
        status: { state: updatedStatus.state, label: updatedStatus.label, nextType: updatedStatus.nextType, lastType: updatedStatus.last?.type || null, lastTimestamp: updatedStatus.last?.timestamp || null } });
    }

    if (req.method === 'GET' && url.pathname === '/api/notifications') {
      const readFilter = String(url.searchParams.get('read') || 'all').toLowerCase();
      const studentId = String(url.searchParams.get('studentId') || '').trim();
      if (!['all', 'read', 'unread'].includes(readFilter)) return json(res, 400, { error: 'Filtro de leitura inválido.' });
      const allowed = new Set(allowedStudentIds(user, db));
      if (studentId && !allowed.has(studentId)) return json(res, 200, { notifications: [] });
      let items = visibleNotifications(user, db);
      if (studentId) items = items.filter((item) => item.studentId === studentId);
      if (readFilter === 'read') items = items.filter((item) => item.read);
      if (readFilter === 'unread') items = items.filter((item) => !item.read);
      return json(res, 200, { notifications: items.slice(0, 150) });
    }

    if (req.method === 'PATCH' && url.pathname.startsWith('/api/notifications/')) {
      const id = url.pathname.split('/').pop();
      const allowed = new Set(allowedStudentIds(user, db));
      const notification = (db.notifications || []).find((n) => n.id === id && n.userId === user.id && (!n.studentId || allowed.has(n.studentId)));
      if (!notification) return json(res, 404, { error: 'Notificação não encontrada.' });
      notification.read = true;
      audit(db, user.id, 'LER_NOTIFICACAO', 'notificacao', notification.id);
      writeDb(db);
      return json(res, 200, { notification });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const filters = reportFilters(url, db, res);
      if (!filters) return;
      const data = buildReportData(user, db, filters);
      return json(res, 200, {
        rows: data.summary,
        records: data.records,
        totals: {
          students: data.summary.length,
          records: data.records.length,
          entradas: data.records.filter((record) => record.type === 'ENTRADA').length,
          saidas: data.records.filter((record) => record.type === 'SAIDA').length,
        },
        disclaimer: 'Relatório de movimentações da portaria; não equivale à frequência em sala de aula nem comprova localização física em tempo real.',
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports.csv') {
      const filters = reportFilters(url, db, res);
      if (!filters) return;
      const data = buildReportData(user, db, filters);
      const rows = [['Aluno', 'Matrícula', 'Turma', 'Tipo', 'Data/Hora', 'Método', 'Registrado por']];
      data.records.forEach((record) => rows.push([
        record.name,
        record.enrollment,
        record.className,
        record.type,
        formatSchoolDateTime(record.timestamp),
        record.method,
        record.registeredBy,
      ]));
      return csv(res, 'safe-student-relatorio-movimentacoes.csv', rows);
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const withUserId = String(url.searchParams.get('withUserId') || '').trim();
      let peer = null;
      if (withUserId) {
        peer = db.users.find((candidate) => candidate.id === withUserId);
        if (!canMessageUser(user, peer)) return json(res, 403, { error: 'Conversa não permitida para este perfil.' });
      }
      const visible = (db.messages || [])
        .filter((message) => (message.fromUserId === user.id || message.toUserId === user.id) &&
          (!withUserId || message.fromUserId === withUserId || message.toUserId === withUserId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((message) => ({
          ...message,
          fromName: userById(db, message.fromUserId)?.name || 'Escola',
          toName: userById(db, message.toUserId)?.name || 'Escola',
        }));
      return json(res, 200, { messages: visible, peer: peer ? directoryUser(peer) : null });
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const body = await parseBody(req);
      db = readDb();
      const text = String(body.text || '').trim().slice(0, 500);
      const to = db.users.find((u) => u.id === body.toUserId);
      if (!text || !to) return json(res, 400, { error: 'Destinatário e mensagem são obrigatórios.' });
      if (!canMessageUser(user, to)) return json(res, 403, { error: 'Destinatário não permitido para este perfil.' });
      db.messages = db.messages || [];
      const message = {
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: to.id,
        text,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(message);
      audit(db, user.id, 'ENVIAR_MENSAGEM', 'mensagem', message.id, `Para ${to.name}`);
      writeDb(db);
      return json(res, 201, { message });
    }

    if (req.method === 'GET' && url.pathname === '/api/directory') {
      return json(res, 200, { people: visibleDirectory(user, db) });
    }

    if (req.method === 'GET' && url.pathname === '/api/feedback') {
      const all = (db.feedback || []).slice().reverse();
      const manager = canManageSchool(user.role);
      const rows = (manager ? all : []).map(feedbackView);
      const measured = all.filter((f) => f.source === 'APRESENTACAO');
      const avg = measured.length
        ? Math.round((measured.reduce((sum, item) => sum + Number(item.score || 0), 0) / measured.length) * 10) / 10
        : 0;
      const successRows = measured.filter((f) => typeof f.success === 'boolean');
      const successRate = successRows.length
        ? Math.round((successRows.filter((f) => f.success).length / successRows.length) * 100)
        : 0;
      const timed = measured.map((f) => Number(f.timeSeconds)).filter((value) => Number.isFinite(value) && value > 0);
      const avgTimeSeconds = timed.length ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length) : 0;
      return json(res, 200, {
        rows,
        avg,
        total: measured.length,
        successRate,
        avgTimeSeconds,
        demoSeedCount: all.length - measured.length,
        disclaimer: 'Registros marcados como DEMO_SEED são ilustrativos e não contam como evidência de pesquisa de campo. A avaliação coletada não armazena a identidade do participante.',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/feedback') {
      const body = await parseBody(req);
      db = readDb();
      const score = Number(body.score);
      const profile = String(body.profile || roleNameForServer(user.role)).trim().slice(0, 60);
      const scenario = String(body.scenario || '').trim().slice(0, 120);
      const comment = String(body.comment || '').trim().slice(0, 300);
      const success = body.success === true || body.success === 'true' || body.success === 'SIM';
      const timeRaw = Number(body.timeSeconds);
      const timeSeconds = Number.isFinite(timeRaw) && timeRaw > 0 && timeRaw <= 3600 ? Math.round(timeRaw) : null;
      if (!Number.isInteger(score) || score < 1 || score > 5 || !comment || !scenario) {
        return json(res, 400, { error: 'Cenário, nota de 1 a 5 e comentário são obrigatórios.' });
      }
      db.feedback = db.feedback || [];
      const feedback = {
        id: crypto.randomUUID(),
        profile,
        scenario,
        success,
        timeSeconds,
        score,
        comment,
        source: 'APRESENTACAO',
        createdAt: new Date().toISOString(),
      };
      db.feedback.push(feedback);
      audit(db, '', 'REGISTRAR_FEEDBACK', 'feedback', feedback.id, 'Avaliação acadêmica registrada sem identificação do participante.');
      writeDb(db);
      return json(res, 201, { feedback });
    }

    if (req.method === 'GET' && url.pathname === '/api/feedback.csv') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Somente gestão pode exportar validação.' });
      const rows = [['Data/Hora', 'Perfil', 'Cenário', 'Sucesso', 'Tempo (s)', 'Nota', 'Comentário', 'Fonte']];
      (db.feedback || [])
        .filter((f) => f.source === 'APRESENTACAO')
        .forEach((f) => rows.push([
          formatSchoolDateTime(f.createdAt),
          f.profile,
          f.scenario || '',
          f.success === true ? 'SIM' : f.success === false ? 'NÃO' : '',
          f.timeSeconds || '',
          f.score,
          f.comment,
          f.source,
        ]));
      return csv(res, 'safe-student-validacao-mvp.csv', rows);
    }

    if (req.method === 'GET' && url.pathname === '/api/audit') {
      if (!canViewAudit(user.role)) return json(res, 403, { error: 'Perfil sem permissão para auditoria.' });
      const q = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase('pt-BR');
      const action = String(url.searchParams.get('action') || '').trim();
      const actorId = String(url.searchParams.get('userId') || '').trim();
      const from = String(url.searchParams.get('from') || '').trim();
      const to = String(url.searchParams.get('to') || '').trim();
      if (!validIsoDate(from) || !validIsoDate(to) || (from && to && from > to)) return json(res, 400, { error: 'Período de auditoria inválido.' });
      let rows = (db.audit || []).map((event) => ({
        ...event,
        userName: event.userId ? (userById(db, event.userId)?.name || 'Sistema') : 'Sistema',
      }));
      if (action) rows = rows.filter((event) => event.action === action);
      if (actorId) rows = rows.filter((event) => event.userId === actorId);
      if (from) rows = rows.filter((event) => dateKey(event.createdAt) >= from);
      if (to) rows = rows.filter((event) => dateKey(event.createdAt) <= to);
      if (q) rows = rows.filter((event) => [event.userName, event.action, event.entity, event.details].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(q)));
      rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 250);
      return json(res, 200, {
        rows,
        actions: [...new Set((db.audit || []).map((event) => event.action))].sort(),
        users: db.users.filter((candidate) => candidate.status === 'ATIVO').map(directoryUser).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/classes') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      return json(res, 200, { classes: db.classes });
    }

    if (req.method === 'POST' && url.pathname === '/api/guardians/invitations') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      const body = await parseBody(req);
      db = readDb();
      const student = db.students.find(s => s.id === body.studentId && s.status === 'ATIVO');
      if (!student) return json(res, 404, { error: 'Estudante ativo não encontrado.' });
      const guardian = { name: String(body.guardian?.name || '').trim(),
        email: normalizeEmail(body.guardian?.email), phone: String(body.guardian?.phone || '').replace(/[^0-9+() -]/g, '').trim(),
        relationship: String(body.guardian?.relationship || '').trim(), cpf: normalizeCpf(body.guardian?.cpf) };
      if (!validPerson(guardian.name) || !validEmail(guardian.email) ||
        guardian.phone.replace(/\D/g, '').length < 10 || guardian.phone.replace(/\D/g, '').length > 13 ||
        !['Mãe','Pai','Responsável legal','Outro'].includes(guardian.relationship)) {
        return json(res, 400, { error: 'Nome, e-mail, telefone e vínculo familiar válidos são obrigatórios.' });
      }
      if (guardian.cpf && !validCpf(guardian.cpf)) {
        return json(res, 400, { error: 'CPF do responsável inválido. Deixe o campo em branco se preferir não informar.' });
      }
      const anyAccount = db.users.find(u => normalizeEmail(u.email) === guardian.email || (guardian.cpf && u.cpf === guardian.cpf));
      if (anyAccount) return json(res, 409, { error: 'E-mail ou CPF já possui conta. Utilize "Vincular responsável existente" e confira a identidade.' });
      const result = issueGuardianInvitation(db, guardian, student.id);
      audit(db, user.id, 'CONVIDAR_RESPONSAVEL', 'aluno', student.id, guardian.name);
      writeDb(db);
      return json(res, 201, result);
    }

    if (req.method === 'DELETE' && /^\/api\/guardians\/invitations\/[^/]+$/.test(url.pathname)) {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      db = readDb();
      const invitation = (db.guardianInvitations || []).find(i => i.id === url.pathname.split('/').pop() && i.status === 'PENDENTE');
      if (!invitation) return json(res, 404, { error: 'Convite pendente não encontrado.' });
      invitation.status = 'REVOGADO'; invitation.codeHash = null;
      audit(db, user.id, 'REVOGAR_CONVITE', 'convite', invitation.id, 'Acesso não ativado revogado.');
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/guardians') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      return json(res, 200, {
        guardians: db.users.filter((candidate) => candidate.role === 'RESPONSAVEL').map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone || '',
          cpfMasked: maskCpf(candidate.cpf),
          status: candidate.status,
          lastLoginAt: candidate.lastLoginAt || null,
          studentIds: candidate.studentIds || [],
          students: (candidate.studentIds || []).map((studentId) => studentById(db, studentId)).filter(Boolean).map((student) => ({ id: student.id, name: student.name, className: className(db, student.classId), status: student.status })),
        })),
        invitations: (db.guardianInvitations || []).filter((invitation) => invitation.status === 'PENDENTE').map((invitation) => ({
          ...guardianInvitationView(invitation),
          students: invitation.studentIds.map((studentId) => studentById(db, studentId)).filter(Boolean).map((student) => ({ id: student.id, name: student.name, className: className(db, student.classId) })),
          daysToExpire: Math.max(0, Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / 86400000)),
        })),
      });
    }

    if (req.method === 'POST' && /^\/api\/guardians\/invitations\/[^/]+\/renew$/.test(url.pathname)) {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      db = readDb();
      const id = url.pathname.split('/')[4];
      const invitation = (db.guardianInvitations || []).find(i => i.id === id && i.status === 'PENDENTE');
      if (!invitation) return json(res, 404, { error: 'Convite pendente não encontrado.' });
      const code = crypto.randomBytes(12).toString('hex').toUpperCase();
      invitation.codeHash = digestCode(code);
      invitation.expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      audit(db, user.id, 'RENOVAR_CONVITE', 'convite', invitation.id, 'Código renovado.');
      writeDb(db);
      return json(res, 200, { invitation: guardianInvitationView(invitation), activationCode: code });
    }

    if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Somente gestão pode reiniciar a apresentação.' });
      fs.copyFileSync(SEED_DB_PATH, DB_PATH);
      const resetDb = readDb();
      audit(resetDb, user.id, 'RESTAURAR_DEMO', 'base_demo', '', 'Base restaurada para o estado inicial.');
      writeDb(resetDb);
      sessions.clear();
      return json(res, 200, { ok: true, message: 'Demonstração restaurada.' });
    }

    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      error: 'Erro interno no MVP.',
      detail: process.env.NODE_ENV === 'test' ? error.message : undefined,
    });
  }
}

const server = http.createServer(handler);
if (require.main === module) {
  server.listen(PORT, () => console.log(`Safe Student MVP em http://localhost:${PORT}`));
}

module.exports = {
  server,
  handler,
  DB_PATH,
  TIME_ZONE,
  dateKey,
  formatSchoolDateTime,
  visibleDirectory,
  sessions,
  loginAttempts,
  passwordResets,
};
