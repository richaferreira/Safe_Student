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
const DB_PATH = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');
const TIME_ZONE = process.env.SS_TIME_ZONE || 'America/Sao_Paulo';
const SESSION_TTL_MS = Number(process.env.SS_SESSION_TTL_MS || 2 * 60 * 60 * 1000);
const sessions = new Map();
const loginAttempts = new Map();

function readDb() {
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
    let data = '';
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      data += chunk;
      if (Buffer.byteLength(data, 'utf8') > 1_000_000) {
        done = true;
        reject(new Error('Corpo da requisição excede 1 MB.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (done) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', (err) => {
      if (!done) reject(err);
    });
  });
}

function safeUser(user) {
  const u = { ...user };
  delete u.passwordHash;
  return u;
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
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(token);
    return null;
  }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s.user;
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
  const c = db.classes.find((x) => x.id === classId);
  return c ? `${c.name} - ${c.shift}` : 'Sem turma';
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
      res.end('Not found');
      return;
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
  const arr = (loginAttempts.get(ip) || []).filter((t) => now - t < 60_000);
  loginAttempts.set(ip, arr);
  return arr.length >= 10;
}

function recordLoginAttempt(ip) {
  const arr = loginAttempts.get(ip) || [];
  arr.push(Date.now());
  loginAttempts.set(ip, arr);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function canMessageUser(from, to) {
  if (!from || !to || from.id === to.id || to.status !== 'ATIVO') return false;
  return canMessageRole(from.role, to.role);
}

function visibleDirectory(user, db) {
  return db.users.filter((u) => canMessageUser(user, u)).map(safeUser);
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
        version: '1.1.0',
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
      const su = safeUser(user);
      sessions.set(token, { user: su, expiresAt: Date.now() + SESSION_TTL_MS });
      audit(db, user.id, 'LOGIN', 'sessao', '', `Perfil ${user.role}`);
      writeDb(db);
      return json(res, 200, { token, user: su, expiresInSeconds: SESSION_TTL_MS / 1000 });
    }

    const user = userFromReq(req);
    if (!user) return json(res, 401, { error: 'Sessão expirada ou ausente.' });

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      sessions.delete(bearerToken(req));
      audit(db, user.id, 'LOGOUT');
      writeDb(db);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { user });

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const ids = allowedStudentIds(user, db);
      const students = db.students
        .filter((s) => ids.includes(s.id))
        .map((s) => ({ ...s, className: className(db, s.classId) }));
      const attendance = db.attendance
        .filter((r) => ids.includes(r.studentId))
        .map((r) => ({ ...r, student: studentById(db, r.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const notifications = (db.notifications || [])
        .filter((n) => n.userId === user.id || ['GESTAO', 'ADMIN'].includes(user.role))
        .map((n) => ({ ...n, student: studentById(db, n.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const today = dateKey();
      const todayAtt = db.attendance.filter((r) => dateKey(r.timestamp) === today);
      const metrics = {
        students: students.length,
        entradasHoje: todayAtt.filter((r) => r.type === 'ENTRADA' && ids.includes(r.studentId)).length,
        saidasHoje: todayAtt.filter((r) => r.type === 'SAIDA' && ids.includes(r.studentId)).length,
        notificacoesNaoLidas: notifications.filter((n) => !n.read).length,
      };
      return json(res, 200, {
        school: { ...db.school, timeZone: db.school?.timeZone || TIME_ZONE },
        students,
        attendance: attendance.slice(0, 60),
        notifications: notifications.slice(0, 30),
        metrics,
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/students') {
      const ids = allowedStudentIds(user, db);
      const result = db.students
        .filter((s) => ids.includes(s.id))
        .map((s) => ({
          ...s,
          className: className(db, s.classId),
          guardians: db.users
            .filter((u) => (u.studentIds || []).includes(s.id))
            .map((u) => ({ id: u.id, name: u.name, email: u.email })),
        }));
      return json(res, 200, { students: result });
    }

    if (req.method === 'POST' && url.pathname === '/api/students') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para cadastrar aluno.' });
      const b = await parseBody(req);
      const name = String(b.name || '').trim();
      const enrollment = String(b.enrollment || '').trim();
      const classId = String(b.classId || '').trim();
      if (name.length < 3 || enrollment.length < 3 || !db.classes.some((c) => c.id === classId)) {
        return json(res, 400, { error: 'Nome, matrícula e turma válidos são obrigatórios.' });
      }
      if (db.students.some((s) => s.enrollment === enrollment)) {
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      }
      const token = `SS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const student = { id: crypto.randomUUID(), name, enrollment, classId, token, status: 'ATIVO' };
      db.students.push(student);
      audit(db, user.id, 'CADASTRAR_ALUNO', 'aluno', student.id, name);
      writeDb(db);
      return json(res, 201, { student: { ...student, className: className(db, classId) } });
    }

    if (req.method === 'POST' && url.pathname === '/api/links') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para vincular responsável.' });
      const b = await parseBody(req);
      const guardian = db.users.find((u) => u.id === b.guardianId && u.role === 'RESPONSAVEL' && u.status === 'ATIVO');
      const student = db.students.find((s) => s.id === b.studentId && s.status === 'ATIVO');
      if (!guardian || !student) return json(res, 404, { error: 'Responsável ou aluno ativo não encontrado.' });
      guardian.studentIds = Array.from(new Set([...(guardian.studentIds || []), student.id]));
      audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, guardian.name);
      writeDb(db);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/attendance') {
      if (!canRegisterAttendance(user.role)) return json(res, 403, { error: 'Perfil sem permissão para registrar presença.' });
      const b = await parseBody(req);
      const type = String(b.type || '').toUpperCase();
      const tokenCode = normalizeToken(b.token);
      if (!['ENTRADA', 'SAIDA'].includes(type)) return json(res, 400, { error: 'Tipo de registro inválido.' });
      const student = db.students.find((s) => s.token === tokenCode && s.status === 'ATIVO');
      if (!student) return json(res, 404, { error: 'Token não encontrado ou aluno inativo.' });
      const today = dateKey();
      const todayRecords = db.attendance.filter((r) => r.studentId === student.id && dateKey(r.timestamp) === today);
      const seq = validateAttendanceSequence(todayRecords, type);
      if (!seq.ok) return json(res, 409, { error: seq.error });
      const now = new Date();
      const rec = {
        id: crypto.randomUUID(),
        studentId: student.id,
        type,
        method: 'QR_TOKEN',
        timestamp: now.toISOString(),
        registeredBy: user.id,
        origin: 'PORTARIA_DEMO',
      };
      db.attendance.push(rec);
      db.notifications = db.notifications || [];
      const guardians = db.users.filter((u) => u.role === 'RESPONSAVEL' && (u.studentIds || []).includes(student.id));
      guardians.forEach((g) => db.notifications.push({
        id: crypto.randomUUID(),
        userId: g.id,
        studentId: student.id,
        title: `${type === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada`,
        message: `${student.name}: ${type.toLowerCase()} registrada no Safe Student em ${formatSchoolDateTime(now)}.`,
        createdAt: now.toISOString(),
        read: false,
        severity: 'INFO',
      }));
      audit(db, user.id, `REGISTRAR_${type}`, 'presenca', rec.id, student.name);
      writeDb(db);
      return json(res, 201, { record: rec, student, notified: guardians.length });
    }

    if (req.method === 'PATCH' && url.pathname.startsWith('/api/notifications/')) {
      const id = url.pathname.split('/').pop();
      const n = (db.notifications || []).find((x) => x.id === id && x.userId === user.id);
      if (!n) return json(res, 404, { error: 'Notificação não encontrada.' });
      n.read = true;
      audit(db, user.id, 'LER_NOTIFICACAO', 'notificacao', n.id);
      writeDb(db);
      return json(res, 200, { notification: n });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const ids = allowedStudentIds(user, db);
      const rows = db.students.filter((s) => ids.includes(s.id)).map((s) => {
        const rec = db.attendance.filter((r) => r.studentId === s.id);
        const entradas = rec.filter((r) => r.type === 'ENTRADA').length;
        const saidas = rec.filter((r) => r.type === 'SAIDA').length;
        return {
          studentId: s.id,
          name: s.name,
          enrollment: s.enrollment,
          className: className(db, s.classId),
          entradas,
          saidas,
          taxaDemo: attendanceRate(rec, 20),
          ultimoRegistro: [...rec].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp || null,
        };
      });
      return json(res, 200, {
        rows,
        disclaimer: 'Taxa calculada sobre 20 dias letivos de referência para apresentação acadêmica.',
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports.csv') {
      const ids = allowedStudentIds(user, db);
      const rows = [['Aluno', 'Matrícula', 'Turma', 'Tipo', 'Data/Hora', 'Método']];
      db.attendance
        .filter((r) => ids.includes(r.studentId))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .forEach((r) => {
          const s = studentById(db, r.studentId);
          rows.push([
            s?.name,
            s?.enrollment,
            className(db, s?.classId),
            r.type,
            formatSchoolDateTime(r.timestamp),
            r.method,
          ]);
        });
      return csv(res, 'safe-student-relatorio-demo.csv', rows);
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const visible = (db.messages || [])
        .filter((m) => m.fromUserId === user.id || m.toUserId === user.id || ['GESTAO', 'ADMIN'].includes(user.role))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          ...m,
          fromName: userById(db, m.fromUserId)?.name || 'Escola',
          toName: userById(db, m.toUserId)?.name || 'Escola',
        }));
      return json(res, 200, { messages: visible });
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const b = await parseBody(req);
      const text = String(b.text || '').trim().slice(0, 500);
      const to = db.users.find((u) => u.id === b.toUserId);
      if (!text || !to) return json(res, 400, { error: 'Destinatário e mensagem são obrigatórios.' });
      if (!canMessageUser(user, to)) return json(res, 403, { error: 'Destinatário não permitido para este perfil.' });
      db.messages = db.messages || [];
      const msg = {
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: to.id,
        text,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(msg);
      audit(db, user.id, 'ENVIAR_MENSAGEM', 'mensagem', msg.id, `Para ${to.name}`);
      writeDb(db);
      return json(res, 201, { message: msg });
    }

    if (req.method === 'GET' && url.pathname === '/api/directory') {
      return json(res, 200, { people: visibleDirectory(user, db) });
    }

    if (req.method === 'GET' && url.pathname === '/api/feedback') {
      const all = (db.feedback || []).slice().reverse();
      const manager = ['GESTAO', 'ADMIN'].includes(user.role);
      const rows = (manager ? all : all.filter((f) => f.userId === user.id)).map((f) => ({
        ...f,
        userName: userById(db, f.userId)?.name || 'Participante',
      }));
      const measured = all.filter((f) => f.source === 'APRESENTACAO');
      const avg = measured.length
        ? Math.round((measured.reduce((a, b) => a + Number(b.score || 0), 0) / measured.length) * 10) / 10
        : 0;
      const successRows = measured.filter((f) => typeof f.success === 'boolean');
      const successRate = successRows.length
        ? Math.round((successRows.filter((f) => f.success).length / successRows.length) * 100)
        : 0;
      const timed = measured.map((f) => Number(f.timeSeconds)).filter((v) => Number.isFinite(v) && v > 0);
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
      const b = await parseBody(req);
      const score = Number(b.score);
      const profile = String(b.profile || roleNameForServer(user.role)).trim().slice(0, 60);
      const scenario = String(b.scenario || '').trim().slice(0, 120);
      const comment = String(b.comment || '').trim().slice(0, 300);
      const success = b.success === true || b.success === 'true' || b.success === 'SIM';
      const timeRaw = Number(b.timeSeconds);
      const timeSeconds = Number.isFinite(timeRaw) && timeRaw > 0 && timeRaw <= 3600 ? Math.round(timeRaw) : null;
      if (!Number.isInteger(score) || score < 1 || score > 5 || !comment || !scenario) {
        return json(res, 400, { error: 'Cenário, nota de 1 a 5 e comentário são obrigatórios.' });
      }
      db.feedback = db.feedback || [];
      const row = {
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
      db.feedback.push(row);
      audit(db, user.id, 'REGISTRAR_FEEDBACK', 'feedback', row.id, `Cenário ${scenario}; nota ${score}`);
      writeDb(db);
      return json(res, 201, { feedback: row });
    }

    if (req.method === 'GET' && url.pathname === '/api/feedback.csv') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Somente gestão pode exportar validação.' });
      const rows = [['Data/Hora', 'Perfil', 'Cenário', 'Sucesso', 'Tempo (s)', 'Nota', 'Comentário', 'Fonte']];
      (db.feedback || []).forEach((f) => rows.push([
        formatSchoolDateTime(f.createdAt),
        f.profile,
        f.scenario || '',
        f.success === true ? 'SIM' : f.success === false ? 'NÃO' : '',
        f.timeSeconds || '',
        f.score,
        f.comment,
        f.source || 'DEMO_SEED',
      ]));
      return csv(res, 'safe-student-validacao-mvp.csv', rows);
    }

    if (req.method === 'GET' && url.pathname === '/api/audit') {
      if (!canViewAudit(user.role)) return json(res, 403, { error: 'Perfil sem permissão para auditoria.' });
      const rows = (db.audit || []).slice(-120).reverse().map((a) => ({
        ...a,
        userName: userById(db, a.userId)?.name || 'Sistema',
      }));
      return json(res, 200, { rows });
    }

    if (req.method === 'GET' && url.pathname === '/api/classes') return json(res, 200, { classes: db.classes });

    if (req.method === 'GET' && url.pathname === '/api/guardians') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão.' });
      return json(res, 200, {
        guardians: db.users.filter((u) => u.role === 'RESPONSAVEL' && u.status === 'ATIVO').map(safeUser),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
      if (!['GESTAO', 'ADMIN'].includes(user.role)) {
        return json(res, 403, { error: 'Somente gestão pode reiniciar a apresentação.' });
      }
      const original = path.join(__dirname, 'data', 'db.seed.json');
      fs.copyFileSync(original, DB_PATH);
      sessions.clear();
      return json(res, 200, { ok: true, message: 'Demonstração restaurada.' });
    }

    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, {
      error: 'Erro interno no MVP.',
      detail: process.env.NODE_ENV === 'test' ? e.message : undefined,
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
