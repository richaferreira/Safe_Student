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
    // Prefix dangerous CSV cell values so spreadsheet apps do not treat user text as a formula.
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
  if (/^(\d)\1{10}$/.test(cpf)) return false; // sequences like 111.111.111-11 pass the checksum but are never real
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

function bearerToken(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function userFromReq(req, db) {
  const token = bearerToken(req);
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  // Revalidate the user on each request: permissions and guardian links may change
  // after login. A stale session must not retain revoked access or outdated links.
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

function reportFilters(url, db, res) {
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const classId = url.searchParams.get('classId') || '';
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const validDate = value => !value || (iso.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);
  if (!validDate(from) || !validDate(to) || (from && to && from > to) ||
    (classId && !db.classes.some(c => c.id === classId))) {
    json(res, 400, { error: 'Filtros inválidos: confira data inicial, data final e turma.' });
    return null;
  }
  return { classId, inRange: timestamp => {
    const key = dateKey(timestamp);
    return (!from || key >= from) && (!to || key <= to);
  }};
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
        // The MVP has no outbound mail service. Returning the code is intentional demo behavior.
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
      const sanitized = safeUser(user);
      sessions.set(token, { user: sanitized, expiresAt: Date.now() + SESSION_TTL_MS });
      audit(db, user.id, 'LOGIN', 'sessao', '', `Perfil ${user.role}`);
      writeDb(db);
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
        cpf: cpf || invitation.cpf || '', passwordHash: hashPassword(password), role: 'RESPONSAVEL', studentIds, status: 'ATIVO' };
      db.users.push(account);
      clearLoginAttempts(ip);
      invitation.status = 'UTILIZADO';
      invitation.codeHash = null;
      // Further invitations for the same approved email are merged into this activated account.
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
      return json(res, 201, { token, user: sanitized, childrenLinked: studentIds.length });
    }

    const user = userFromReq(req, db);
    if (!user) return json(res, 401, { error: 'Sessão expirada ou ausente.' });

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      sessions.delete(bearerToken(req));
      audit(db, user.id, 'LOGOUT');
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      return json(res, 200, { user });
    }

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const ids = allowedStudentIds(user, db);
      const allowed = new Set(ids);
      const students = scopedStudents(user, db).map((s) => studentView(user, db, s));
      const attendance = db.attendance
        .filter((r) => allowed.has(r.studentId))
        .map((r) => ({ ...r, student: studentById(db, r.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const notifications = (db.notifications || [])
        .filter((n) => n.userId === user.id)
        .map((n) => ({ ...n, student: studentById(db, n.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const today = dateKey();
      const todayAtt = db.attendance
        .filter((r) => dateKey(r.timestamp) === today && allowed.has(r.studentId))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      // Only the most recent event is displayed; a record is not proof of live location.
      const latestToday = new Map();
      todayAtt.forEach((record) => latestToday.set(record.studentId, record));
      const studentStatuses = students.map((student) => {
        const last = latestToday.get(student.id);
        return {
          id: student.id,
          name: student.name,
          className: student.className,
          lastType: last?.type || null,
          lastTimestamp: last?.timestamp || null,
        };
      });
      // Aggregates must be calculated on the server, *after* student scoping.
      // These are movements, NOT classroom attendance or proof of physical location.
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
        if (!byClass.has(key)) byClass.set(key, { name: key, students: 0, entradasSemSaida: 0, saidas: 0, semRegistro: 0 });
        const row = byClass.get(key);
        row.students += 1;
        if (student.lastType === 'ENTRADA') row.entradasSemSaida += 1;
        else if (student.lastType === 'SAIDA') row.saidas += 1;
        else row.semRegistro += 1;
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
      return json(res, 200, {
        school: { ...db.school, timeZone: db.school?.timeZone || TIME_ZONE },
        students,
        studentStatuses,
        weeklyMovements,
        classOverview: [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        recentMessages,
        attendance: attendance.slice(0, 60),
        notifications: notifications.slice(0, 30),
        metrics: {
          students: students.length,
          entradasHoje: todayAtt.filter((r) => r.type === 'ENTRADA').length,
          saidasHoje: todayAtt.filter((r) => r.type === 'SAIDA').length,
          semSaidaHoje: Array.from(latestToday.values()).filter((r) => r.type === 'ENTRADA').length,
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
      const existingGuardian = body.guardianId && db.users.find(u => u.id === body.guardianId && u.role === 'RESPONSAVEL' && u.status === 'ATIVO');
      if (body.guardianId && !existingGuardian) return json(res, 404, { error: 'Responsável existente não encontrado ou sem acesso ativo.' });
      const guardian = body.guardian && {
        name: String(body.guardian.name || '').trim(), email: normalizeEmail(body.guardian.email),
        phone: String(body.guardian.phone || '').replace(/[^0-9+() -]/g, '').trim(),
        relationship: String(body.guardian.relationship || '').trim(),
        cpf: normalizeCpf(body.guardian.cpf),
      };
      if (!validPerson(name) || enrollment.length < 3 || enrollment.length > 40 || !db.classes.some(c => c.id === classId)) {
        return json(res, 400, { error: 'Nome, matrícula e turma válidos são obrigatórios.' });
      }
      if (db.students.some(s => s.enrollment.toLowerCase() === enrollment.toLowerCase())) {
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      }
      if (!existingGuardian && (!guardian || !validPerson(guardian.name) || !validEmail(guardian.email)
        || guardian.phone.replace(/\D/g, '').length < 10 || guardian.phone.replace(/\D/g, '').length > 13
        || !['Mãe','Pai','Responsável legal','Outro'].includes(guardian.relationship))) {
        return json(res, 400, { error: 'Informe o responsável: nome, e-mail válido, telefone e vínculo familiar. Também pode selecionar uma conta existente.' });
      }
      if (!existingGuardian && guardian.cpf && !validCpf(guardian.cpf)) {
        return json(res, 400, { error: 'CPF do responsável inválido. Deixe o campo em branco se preferir não informar.' });
      }
      if (guardian && !existingGuardian && db.users.some(u => u.email.toLowerCase() === guardian.email && u.role !== 'RESPONSAVEL')) {
        return json(res, 409, { error: 'Este e-mail já pertence a outro perfil. Solicite conferência à gestão.' });
      }
      if (guardian && !existingGuardian && guardian.cpf && db.users.some(u => u.cpf === guardian.cpf && u.role !== 'RESPONSAVEL')) {
        return json(res, 409, { error: 'Este CPF já pertence a outro perfil. Solicite conferência à gestão.' });
      }
      const matchedGuardian = existingGuardian || (guardian && db.users.find(u => u.role === 'RESPONSAVEL' && u.status === 'ATIVO' &&
        ((guardian.email && normalizeEmail(u.email) === guardian.email) || (guardian.cpf && u.cpf && u.cpf === guardian.cpf))));
      if (matchedGuardian && guardian && !existingGuardian && guardian.name.toLocaleLowerCase('pt-BR') !== matchedGuardian.name.toLocaleLowerCase('pt-BR')) {
        return json(res, 409, { error: 'O e-mail ou CPF informado já possui responsável cadastrado com outro nome. Confira o cadastro antes de vincular.' });
      }
      const student = { id: crypto.randomUUID(), name, enrollment, classId,
        token: uniqueStudentToken(db), status: 'ATIVO' };
      db.students.push(student);
      let invitation = null;
      if (matchedGuardian) {
        matchedGuardian.studentIds = [...new Set([...(matchedGuardian.studentIds || []), student.id])];
        audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, matchedGuardian.name);
      } else {
        invitation = issueGuardianInvitation(db, guardian, student.id);
        audit(db, user.id, 'CONVIDAR_RESPONSAVEL', 'aluno', student.id, guardian.name);
      }
      audit(db, user.id, 'CADASTRAR_ALUNO', 'aluno', student.id, name);
      writeDb(db); // Student and approved guardian link/invitation committed together.
      return json(res, 201, { student: studentView(user, db, student, { includeGuardians: true }), invitation,
        guardianLinked: Boolean(matchedGuardian) });
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
      const record = {
        id: crypto.randomUUID(),
        studentId: student.id,
        type,
        method: 'TOKEN_MANUAL',
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
      return json(res, 201, { record, student: studentView(user, db, student), notified: guardians.length });
    }

    if (req.method === 'PATCH' && url.pathname.startsWith('/api/notifications/')) {
      const id = url.pathname.split('/').pop();
      const notification = (db.notifications || []).find((n) => n.id === id && n.userId === user.id);
      if (!notification) return json(res, 404, { error: 'Notificação não encontrada.' });
      notification.read = true;
      audit(db, user.id, 'LER_NOTIFICACAO', 'notificacao', notification.id);
      writeDb(db);
      return json(res, 200, { notification });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const range = reportFilters(url, db, res);
      if (!range) return;
      const ids = new Set(allowedStudentIds(user, db));
      const rows = db.students.filter((s) => ids.has(s.id) && (!range.classId || s.classId === range.classId)).map((s) => {
        const records = db.attendance.filter((r) => r.studentId === s.id && range.inRange(r.timestamp));
        return {
          studentId: s.id,
          name: s.name,
          enrollment: s.enrollment,
          className: className(db, s.classId),
          entradas: records.filter((r) => r.type === 'ENTRADA').length,
          saidas: records.filter((r) => r.type === 'SAIDA').length,
          taxaDemo: attendanceRate(records, 20, dateKey),
          ultimoRegistro: [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp || null,
        };
      });
      return json(res, 200, {
        rows,
        disclaimer: 'Contagem de movimentações de portaria; não equivale à frequência em sala de aula. A taxa de demonstração usa dias fictícios e não deve ser usada para avaliação escolar.',
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports.csv') {
      const range = reportFilters(url, db, res);
      if (!range) return;
      const ids = new Set(allowedStudentIds(user, db));
      const rows = [['Aluno', 'Matrícula', 'Turma', 'Tipo', 'Data/Hora', 'Método']];
      db.attendance
        .filter((r) => ids.has(r.studentId) && range.inRange(r.timestamp) && (!range.classId || studentById(db, r.studentId)?.classId === range.classId))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .forEach((r) => {
          const student = studentById(db, r.studentId);
          rows.push([
            student?.name,
            student?.enrollment,
            className(db, student?.classId),
            r.type,
            formatSchoolDateTime(r.timestamp),
            r.method,
          ]);
        });
      return csv(res, 'safe-student-relatorio-demo.csv', rows);
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const visible = (db.messages || [])
        .filter((m) => m.fromUserId === user.id || m.toUserId === user.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          ...m,
          fromName: userById(db, m.fromUserId)?.name || 'Escola',
          toName: userById(db, m.toUserId)?.name || 'Escola',
        }));
      return json(res, 200, { messages: visible });
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
      const rows = (db.audit || []).slice(-120).reverse().map((event) => ({
        ...event,
        userName: event.userId ? (userById(db, event.userId)?.name || 'Sistema') : 'Sistema',
      }));
      return json(res, 200, { rows });
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
        guardians: db.users.filter(u => u.role === 'RESPONSAVEL').map(u =>
          ({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', cpfMasked: maskCpf(u.cpf), status: u.status,
            studentIds: u.studentIds || [] })),
        invitations: (db.guardianInvitations || []).filter(i => i.status === 'PENDENTE').map(guardianInvitationView),
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
