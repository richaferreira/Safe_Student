const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { verifyPassword, randomToken } = require('./lib/security');
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
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
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

function directoryUser(user) {
  return { id: user.id, name: user.name, role: user.role, status: user.status };
}

function uniqueStudentToken(db) {
  for (let i = 0; i < 32; i += 1) {
    const token = `SS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
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

function userFromReq(req) {
  const token = bearerToken(req);
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
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
  const ids = new Set(allowedStudentIds(user, db));
  return db.students.filter((s) => ids.has(s.id));
}

async function handler(req, res) {
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    const db = readDb();

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        version: '2.0.0',
        mode: 'academic-demo',
        timeZone: TIME_ZONE,
      });
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

    const user = userFromReq(req);
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
      const students = scopedStudents(user, db).map((s) => ({ ...s, className: className(db, s.classId) }));
      const attendance = db.attendance
        .filter((r) => allowed.has(r.studentId))
        .map((r) => ({ ...r, student: studentById(db, r.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const notifications = (db.notifications || [])
        .filter((n) => n.userId === user.id)
        .map((n) => ({ ...n, student: studentById(db, n.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const today = dateKey();
      const todayAtt = db.attendance.filter((r) => dateKey(r.timestamp) === today && allowed.has(r.studentId));
      return json(res, 200, {
        school: { ...db.school, timeZone: db.school?.timeZone || TIME_ZONE },
        students,
        attendance: attendance.slice(0, 60),
        notifications: notifications.slice(0, 30),
        metrics: {
          students: students.length,
          entradasHoje: todayAtt.filter((r) => r.type === 'ENTRADA').length,
          saidasHoje: todayAtt.filter((r) => r.type === 'SAIDA').length,
          notificacoesNaoLidas: notifications.filter((n) => !n.read).length,
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/students') {
      const result = scopedStudents(user, db).map((s) => ({
        ...s,
        className: className(db, s.classId),
        guardians: canManageSchool(user.role)
          ? db.users
            .filter((u) => u.role === 'RESPONSAVEL' && (u.studentIds || []).includes(s.id))
            .map((u) => ({ id: u.id, name: u.name }))
          : [],
      }));
      return json(res, 200, { students: result });
    }

    if (req.method === 'POST' && url.pathname === '/api/students') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para cadastrar aluno.' });
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const enrollment = String(body.enrollment || '').trim();
      const classId = String(body.classId || '').trim();
      if (name.length < 3 || enrollment.length < 3 || !db.classes.some((c) => c.id === classId)) {
        return json(res, 400, { error: 'Nome, matrícula e turma válidos são obrigatórios.' });
      }
      if (db.students.some((s) => s.enrollment === enrollment)) {
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      }
      const student = {
        id: crypto.randomUUID(),
        name,
        enrollment,
        classId,
        token: uniqueStudentToken(db),
        status: 'ATIVO',
      };
      db.students.push(student);
      audit(db, user.id, 'CADASTRAR_ALUNO', 'aluno', student.id, name);
      writeDb(db);
      return json(res, 201, { student: { ...student, className: className(db, classId) } });
    }

    if (req.method === 'POST' && url.pathname === '/api/links') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para vincular responsável.' });
      const body = await parseBody(req);
      const guardian = db.users.find((u) => u.id === body.guardianId && u.role === 'RESPONSAVEL' && u.status === 'ATIVO');
      const student = db.students.find((s) => s.id === body.studentId && s.status === 'ATIVO');
      if (!guardian || !student) return json(res, 404, { error: 'Responsável ou aluno ativo não encontrado.' });
      guardian.studentIds = Array.from(new Set([...(guardian.studentIds || []), student.id]));
      audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, guardian.name);
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/attendance') {
      if (!canRegisterAttendance(user.role)) return json(res, 403, { error: 'Perfil sem permissão para registrar presença.' });
      const body = await parseBody(req);
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
        method: 'QR_TOKEN',
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
      return json(res, 201, { record, student, notified: guardians.length });
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
      const ids = new Set(allowedStudentIds(user, db));
      const rows = db.students.filter((s) => ids.has(s.id)).map((s) => {
        const records = db.attendance.filter((r) => r.studentId === s.id);
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
        disclaimer: 'Taxa calculada sobre 20 dias letivos de referência para apresentação acadêmica.',
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports.csv') {
      const ids = new Set(allowedStudentIds(user, db));
      const rows = [['Aluno', 'Matrícula', 'Turma', 'Tipo', 'Data/Hora', 'Método']];
      db.attendance
        .filter((r) => ids.has(r.studentId))
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
      const rows = (manager ? all : all.filter((f) => f.userId === user.id)).map((f) => ({
        ...f,
        userName: userById(db, f.userId)?.name || 'Participante',
      }));
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
        disclaimer: 'Registros marcados como DEMO_SEED são ilustrativos e não contam como evidência de pesquisa de campo.',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/feedback') {
      const body = await parseBody(req);
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
        userId: user.id,
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
      audit(db, user.id, 'REGISTRAR_FEEDBACK', 'feedback', feedback.id, `Cenário ${scenario}; nota ${score}`);
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
        userName: userById(db, event.userId)?.name || 'Sistema',
      }));
      return json(res, 200, { rows });
    }

    if (req.method === 'GET' && url.pathname === '/api/classes') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      return json(res, 200, { classes: db.classes });
    }

    if (req.method === 'GET' && url.pathname === '/api/guardians') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      return json(res, 200, {
        guardians: db.users
          .filter((u) => u.role === 'RESPONSAVEL' && u.status === 'ATIVO')
          .map((u) => ({ id: u.id, name: u.name })),
      });
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
};
