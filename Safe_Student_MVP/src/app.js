/**
 * Aplicação HTTP principal do Safe Student.
 *
 * Este arquivo concentra apenas o roteamento da API. Regras auxiliares foram
 * separadas em módulos de configuração, persistência, autenticação e serviços.
 * Assim o fluxo continua simples de acompanhar em uma disciplina de Engenharia
 * de Software, mas cada responsabilidade fica em seu lugar.
 */
const crypto = require('crypto');

const { config } = require('./config');
const { readDatabase: readDb, writeDatabase: writeDb, resetDatabase } = require('./database/repository');
const { sendJson: json, sendCsv: csv, parseJsonBody: parseBody } = require('./http/response');
const { applySecurityHeaders: securityHeaders, serveStatic } = require('./http/staticFiles');
const { hashPassword, verifyPassword, randomToken } = require('./services/security');
const {
  normalizeToken,
  canRegisterAttendance,
  canManageSchool,
  canViewAudit,
  allowedStudentIds,
  validateAttendanceSequence,
  attendanceRate,
  canMessageRole,
} = require('./services/domain');
const {
  normalizeEmail,
  isValidEmail: validEmail,
  normalizeCpf,
  isValidCpf: validCpf,
  maskCpf,
  digestCode,
  isValidPersonName: validPerson,
} = require('./utils/validation');
const { dateKey, formatSchoolDateTime } = require('./utils/dateTime');
const { sessions, loginAttempts, passwordResets } = require('./auth/state');
const {
  safeUser,
  authToken,
  setSessionCookie,
  clearSessionCookie,
  userFromRequest: userFromReq,
  isRateLimited: rateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
} = require('./auth/session');
const { addAudit: audit } = require('./services/auditService');
const { guardianInvitationView, issueGuardianInvitation } = require('./services/guardianService');
const {
  className,
  studentById,
  userById,
  uniqueStudentToken,
  studentOperationalStatus,
  studentView,
  profileAuditForStudent,
} = require('./services/studentService');
const {
  directoryUser,
  roleName: roleNameForServer,
  canMessageUser,
  visibleDirectory,
  scopedStudents,
  canAccessStudent,
} = require('./services/accessService');
const { reportFilters, studentProfileFilters } = require('./services/filterService');
const { feedbackView } = require('./services/feedbackService');

const TIME_ZONE = config.timeZone;
const SESSION_TTL_MS = config.sessionTtlMs;
const DB_PATH = config.dbPath;

async function handler(req, res) {
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    let db = readDb();

    // -------------------------------------------------------------------------
    // Rotas públicas: saúde, recuperação de senha, login e ativação de responsável
    // -------------------------------------------------------------------------
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
      const sanitized = safeUser(user);
      sessions.set(token, { user: sanitized, expiresAt: Date.now() + SESSION_TTL_MS });
      setSessionCookie(res, token);
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

    // -------------------------------------------------------------------------
    // Sessão autenticada, busca global e painel
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      sessions.delete(authToken(req));
      clearSessionCookie(res);
      audit(db, user.id, 'LOGOUT');
      writeDb(db);
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
      const notifications = (db.notifications || [])
        .filter((n) => n.userId === user.id)
        .map((n) => ({ ...n, student: studentById(db, n.studentId)?.name || 'Aluno' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const today = dateKey();
      const todayAtt = db.attendance
        .filter((r) => dateKey(r.timestamp) === today && allowed.has(r.studentId))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      // Somente o evento mais recente é exibido; um registro não prova localização em tempo real.
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
      const pendingInvitations = canManageSchool(user.role)
        ? (db.guardianInvitations || []).filter((invitation) => invitation.status === 'PENDENTE').length : 0;
      const unlinkedStudents = canManageSchool(user.role)
        ? students.filter((student) => !db.users.some((candidate) => candidate.role === 'RESPONSAVEL' && candidate.status === 'ATIVO' && (candidate.studentIds || []).includes(student.id)) && !(db.guardianInvitations || []).some((invitation) => invitation.status === 'PENDENTE' && invitation.studentIds.includes(student.id))).length : 0;
      const attention = [];
      if (Array.from(latestToday.values()).filter((record) => record.type === 'ENTRADA').length) {
        attention.push({ type: 'warning', label: 'Entradas sem saída', count: Array.from(latestToday.values()).filter((record) => record.type === 'ENTRADA').length, description: 'Registros que precisam de conferência', view: 'students', action: 'Ver alunos' });
      }
      if (pendingInvitations) attention.push({ type: 'info', label: 'Convites pendentes', count: pendingInvitations, description: 'Responsáveis aguardando ativação', view: 'guardians', action: 'Revisar convites' });
      if (unlinkedStudents) attention.push({ type: 'warning', label: 'Alunos sem responsável', count: unlinkedStudents, description: 'Cadastros que exigem revisão', view: 'students', action: 'Resolver agora' });
      if (notifications.filter((notification) => !notification.read).length) attention.push({ type: 'info', label: 'Notificações não lidas', count: notifications.filter((notification) => !notification.read).length, description: 'Avisos disponíveis para sua conta', view: 'notifications', action: 'Ver notificações' });
      if (!attention.length) attention.push({ type: 'ok', label: 'Nenhuma pendência crítica', count: 0, description: 'A rotina está em dia neste momento', view: 'dashboard', action: 'Continuar acompanhamento' });
      const timeline = [
        ...attendance.slice(0, 8).map((record) => ({ type: record.type === 'ENTRADA' ? 'entrada' : 'saida', title: `${record.type === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada`, description: record.student, createdAt: record.timestamp, view: 'presence', studentId: record.studentId })),
        ...notifications.slice(0, 5).map((notification) => ({ type: 'notificacao', title: notification.title, description: notification.student, createdAt: notification.createdAt, view: 'notifications', studentId: notification.studentId })),
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
        operations: { pendingInvitations, unlinkedStudents },
        recentMessages,
        attendance: attendance.slice(0, 60),
        notifications: notifications.slice(0, 30),
        metrics: {
          students: students.length,
          entradasHoje: todayAtt.filter((r) => r.type === 'ENTRADA').length,
          saidasHoje: todayAtt.filter((r) => r.type === 'SAIDA').length,
          semSaidaHoje: Array.from(latestToday.values()).filter((r) => r.type === 'ENTRADA').length,
          dentroHoje: Array.from(latestToday.values()).filter((r) => r.type === 'ENTRADA').length,
          foraHoje: Array.from(latestToday.values()).filter((r) => r.type === 'SAIDA').length,
          semRegistroHoje: students.length - latestToday.size,
          notificacoesNaoLidas: notifications.filter((n) => !n.read).length,
        },
      });
    }

    // -------------------------------------------------------------------------
    // Alunos, histórico individual e vínculos familiares
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && url.pathname === '/api/students') {
      const result = scopedStudents(user, db).map((s) => studentView(user, db, s, { includeGuardians: true }));
      return json(res, 200, { students: result });
    }

    if (req.method === 'GET' && /^\/api\/students\/[^/]+\/profile$/.test(url.pathname)) {
      const studentId = url.pathname.split('/')[3];
      const student = studentById(db, studentId);
      if (!student || !canAccessStudent(user, db, student)) return json(res, 404, { error: 'Aluno não encontrado no seu escopo.' });
      const filters = studentProfileFilters(url, res);
      if (!filters) return;

      const movements = (db.attendance || [])
        .filter(row => row.studentId === student.id && filters.inRange(row.timestamp) && (!filters.type || row.type === filters.type))
        .map(row => ({
          ...row,
          registeredByName: userById(db, row.registeredBy)?.name || 'Sistema',
          registeredByRole: userById(db, row.registeredBy)?.role || '',
        }))
        .filter(row => !filters.q || [row.type, row.method, row.registeredByName, formatSchoolDateTime(row.timestamp)]
          .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(filters.q)))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const profileGuardians = canManageSchool(user.role) ? [
        ...db.users.filter(account => account.role === 'RESPONSAVEL' && (account.studentIds || []).includes(student.id)).map(account => ({
          id: account.id, name: account.name, email: account.email, phone: account.phone || '', status: account.status, type: 'CONTA_ATIVA',
        })),
        ...(db.guardianInvitations || []).filter(inv => inv.status === 'PENDENTE' && (inv.studentIds || []).includes(student.id)).map(inv => ({
          id: inv.id, name: inv.name, email: inv.email, phone: inv.phone || '', relationship: inv.relationship || '', status: 'PENDENTE', type: 'CONVITE', expiresAt: inv.expiresAt,
        })),
      ] : [];

      const notifications = user.role === 'RESPONSAVEL' ? (db.notifications || [])
        .filter(item => item.userId === user.id && item.studentId === student.id && filters.inRange(item.createdAt))
        .filter(item => !filters.q || [item.title, item.message].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(filters.q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

      const administrative = canManageSchool(user.role) ? profileAuditForStudent(db, student)
        .filter(event => filters.inRange(event.createdAt))
        .map(event => ({ ...event, userName: event.userId ? (userById(db, event.userId)?.name || 'Sistema') : 'Sistema' }))
        .filter(event => !filters.q || [event.userName, event.action, event.entity, event.details]
          .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(filters.q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

      const timeline = [
        ...movements.map(row => ({ id: `movement:${row.id}`, category: 'MOVIMENTACAO', createdAt: row.timestamp,
          title: row.type === 'ENTRADA' ? 'Entrada registrada' : 'Saída registrada',
          description: `${row.method || 'Método não informado'} · por ${row.registeredByName}`, type: row.type, method: row.method })),
        ...notifications.map(item => ({ id: `notification:${item.id}`, category: 'NOTIFICACAO', createdAt: item.createdAt,
          title: item.title, description: item.message, read: item.read })),
        ...administrative.map(event => ({ id: `audit:${event.id}`, category: 'ADMINISTRATIVO', createdAt: event.createdAt,
          title: event.action, description: event.details || event.entity || 'Alteração administrativa', userName: event.userName })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const allMovements = (db.attendance || []).filter(row => row.studentId === student.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const lastMovement = allMovements[0] || null;
      return json(res, 200, {
        student: studentView(user, db, student, { includeGuardians: canManageSchool(user.role) }),
        operational: studentOperationalStatus(db, student.id),
        guardians: profileGuardians,
        movements,
        notifications,
        administrative,
        timeline,
        metrics: {
          movements: movements.length,
          entradas: movements.filter(row => row.type === 'ENTRADA').length,
          saidas: movements.filter(row => row.type === 'SAIDA').length,
          firstMovement: movements.length ? movements[movements.length - 1].timestamp : null,
          lastMovement: movements[0]?.timestamp || null,
          allTimeMovements: allMovements.length,
          allTimeLastMovement: lastMovement?.timestamp || null,
          unreadNotifications: notifications.filter(item => !item.read).length,
        },
        permissions: {
          canManage: canManageSchool(user.role),
          canOperate: canRegisterAttendance(user.role),
          canSeeFamilyContacts: canManageSchool(user.role),
          canSeeOwnNotifications: user.role === 'RESPONSAVEL',
          canSeeAdministrativeHistory: canManageSchool(user.role),
        },
        filters: { from: filters.from, to: filters.to, type: filters.type, q: filters.q },
        disclaimer: 'Histórico de movimentações da portaria. Os registros não comprovam frequência em sala nem localização física em tempo real.',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/students') {
      if (!canManageSchool(user.role)) return json(res, 403, { error: 'Perfil sem permissão para cadastrar aluno.' });
      const body = await parseBody(req);
      db = readDb();
      const name = String(body.name || '').trim();
      const enrollment = String(body.enrollment || '').trim();
      const classId = String(body.classId || '').trim();
      if (!validPerson(name) || enrollment.length < 3 || enrollment.length > 40 || !db.classes.some(c => c.id === classId)) {
        return json(res, 400, { error: 'Nome, matrícula e turma válidos são obrigatórios.' });
      }
      if (db.students.some(s => s.enrollment.toLowerCase() === enrollment.toLowerCase())) {
        return json(res, 409, { error: 'Matrícula já cadastrada.' });
      }

      // Compatibilidade: o payload antigo envia guardianId/guardian. A evolução aceita uma lista
      // de responsáveis e valida TODOS antes de persistir o aluno, preservando a operação atômica.
      let guardianInputs = Array.isArray(body.guardians) ? body.guardians : [];
      if (!guardianInputs.length && (body.guardianId || body.guardian)) {
        guardianInputs = [{ guardianId: body.guardianId || '', guardian: body.guardian || null }];
      }
      if (!guardianInputs.length) return json(res, 400, { error: 'Cadastre ou selecione pelo menos um responsável para o aluno.' });
      if (guardianInputs.length > 4) return json(res, 400, { error: 'O MVP aceita até quatro responsáveis por aluno em uma única matrícula.' });

      const resolved = [];
      const seen = new Set();
      for (const item of guardianInputs) {
        const guardianId = String(item?.guardianId || '').trim();
        if (guardianId) {
          const account = db.users.find(u => u.id === guardianId && u.role === 'RESPONSAVEL' && u.status === 'ATIVO');
          if (!account) return json(res, 404, { error: 'Um dos responsáveis selecionados não foi encontrado ou está sem acesso ativo.' });
          const key = `account:${account.id}`;
          if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'account', account }); }
          continue;
        }
        const source = item?.guardian || item || {};
        const candidate = {
          name: String(source.name || '').trim(),
          email: normalizeEmail(source.email),
          phone: String(source.phone || '').replace(/[^0-9+() -]/g, '').trim(),
          relationship: String(source.relationship || '').trim(),
          cpf: normalizeCpf(source.cpf),
        };
        if (!validPerson(candidate.name) || !validEmail(candidate.email) ||
          candidate.phone.replace(/\D/g, '').length < 10 || candidate.phone.replace(/\D/g, '').length > 13 ||
          !['Mãe', 'Pai', 'Responsável legal', 'Outro'].includes(candidate.relationship)) {
          return json(res, 400, { error: 'Todos os responsáveis novos precisam de nome, e-mail válido, telefone e vínculo familiar.' });
        }
        if (candidate.cpf && !validCpf(candidate.cpf)) return json(res, 400, { error: `CPF inválido para ${candidate.name}.` });
        if (db.users.some(u => normalizeEmail(u.email) === candidate.email && u.role !== 'RESPONSAVEL')) {
          return json(res, 409, { error: `O e-mail de ${candidate.name} já pertence a outro perfil.` });
        }
        if (candidate.cpf && db.users.some(u => u.cpf === candidate.cpf && u.role !== 'RESPONSAVEL')) {
          return json(res, 409, { error: `O CPF de ${candidate.name} já pertence a outro perfil.` });
        }
        const matched = db.users.find(u => u.role === 'RESPONSAVEL' && u.status === 'ATIVO' &&
          (normalizeEmail(u.email) === candidate.email || (candidate.cpf && u.cpf === candidate.cpf)));
        if (matched && candidate.name.toLocaleLowerCase('pt-BR') !== matched.name.toLocaleLowerCase('pt-BR')) {
          return json(res, 409, { error: `O nome informado (${candidate.name}) não confere com o responsável ${matched.name} associado ao e-mail ou CPF. Confira antes de vincular.` });
        }
        if (matched) {
          const key = `account:${matched.id}`;
          if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'account', account: matched }); }
        } else {
          const key = candidate.cpf ? `cpf:${candidate.cpf}` : `email:${candidate.email}`;
          if (!seen.has(key)) { seen.add(key); resolved.push({ kind: 'invite', guardian: candidate }); }
        }
      }
      if (!resolved.length) return json(res, 400, { error: 'Nenhum responsável válido foi informado.' });

      const student = { id: crypto.randomUUID(), name, enrollment, classId,
        token: uniqueStudentToken(db), status: 'ATIVO' };
      db.students.push(student);
      const invitations = [];
      const linkedGuardians = [];
      for (const item of resolved) {
        if (item.kind === 'account') {
          item.account.studentIds = [...new Set([...(item.account.studentIds || []), student.id])];
          linkedGuardians.push({ id: item.account.id, name: item.account.name });
          audit(db, user.id, 'VINCULAR_RESPONSAVEL', 'aluno', student.id, item.account.name);
        } else {
          const result = issueGuardianInvitation(db, item.guardian, student.id);
          invitations.push(result);
          audit(db, user.id, 'CONVIDAR_RESPONSAVEL', 'aluno', student.id, item.guardian.name);
        }
      }
      audit(db, user.id, 'CADASTRAR_ALUNO', 'aluno', student.id,
        `${name}; responsáveis: ${resolved.length}`);
      writeDb(db);
      return json(res, 201, {
        student: studentView(user, db, student, { includeGuardians: true }),
        invitations,
        invitation: invitations[0] || null,
        linkedGuardians,
        guardianLinked: linkedGuardians.length > 0,
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
      audit(db, user.id, 'ATUALIZAR_ALUNO', 'aluno', student.id, `${student.name}; matrícula ${student.enrollment}; turma ${className(db, student.classId)}; situação ${student.status}`);
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

    // -------------------------------------------------------------------------
    // Portaria e notificações
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && url.pathname === '/api/attendance/lookup') {
      if (!canRegisterAttendance(user.role)) return json(res, 403, { error: 'Perfil sem permissão para operar a portaria.' });
      const tokenCode = normalizeToken(url.searchParams.get('token'));
      if (!tokenCode) return json(res, 400, { error: 'Informe o token do estudante.' });
      const student = db.students.find((item) => item.token === tokenCode && item.status === 'ATIVO');
      if (!student) return json(res, 404, { error: 'Token não encontrado ou estudante inativo.' });
      const operational = studentOperationalStatus(db, student.id);
      return json(res, 200, {
        student: studentView(user, db, student, { includeGuardians: false }),
        operational,
        nextAction: operational.nextAction,
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
      return json(res, 201, { record, student: studentView(user, db, student), notified: guardians.length });
    }

    if (req.method === 'GET' && url.pathname === '/api/notifications') {
      const unreadOnly = url.searchParams.get('unread') === '1';
      const studentId = String(url.searchParams.get('studentId') || '');
      const allowed = new Set(allowedStudentIds(user, db));
      const rows = (db.notifications || [])
        .filter(item => item.userId === user.id)
        .filter(item => !unreadOnly || !item.read)
        .filter(item => !studentId || (allowed.has(studentId) && item.studentId === studentId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(item => ({ ...item, student: studentById(db, item.studentId)?.name || 'Aluno' }));
      return json(res, 200, {
        notifications: rows,
        unread: rows.filter(item => !item.read).length,
        total: rows.length,
      });
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

    // -------------------------------------------------------------------------
    // Relatórios e exportação
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const range = reportFilters(url, db, res);
      if (!range) return;
      const ids = new Set(allowedStudentIds(user, db));
      const selectedStudents = db.students.filter((student) => ids.has(student.id) &&
        (!range.classId || student.classId === range.classId) && (!range.studentId || student.id === range.studentId));
      const selectedIds = new Set(selectedStudents.map(student => student.id));
      const events = db.attendance
        .filter(record => selectedIds.has(record.studentId) && range.inRange(record.timestamp) && (!range.type || record.type === range.type))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map(record => {
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
          };
        });
      const rows = selectedStudents.map((student) => {
        const records = events.filter(record => record.studentId === student.id);
        return {
          studentId: student.id,
          name: student.name,
          enrollment: student.enrollment,
          className: className(db, student.classId),
          entradas: records.filter((record) => record.type === 'ENTRADA').length,
          saidas: records.filter((record) => record.type === 'SAIDA').length,
          taxaDemo: attendanceRate(records, 20, dateKey),
          ultimoRegistro: records[0]?.timestamp || null,
        };
      });
      return json(res, 200, {
        rows,
        events,
        summary: {
          students: selectedStudents.length,
          movements: events.length,
          entradas: events.filter(event => event.type === 'ENTRADA').length,
          saidas: events.filter(event => event.type === 'SAIDA').length,
        },
        appliedFilters: { from: range.from, to: range.to, classId: range.classId, studentId: range.studentId, type: range.type },
        disclaimer: 'Relatório de movimentações da portaria; entrada e saída não equivalem à frequência em sala de aula.',
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/reports.csv') {
      const range = reportFilters(url, db, res);
      if (!range) return;
      const ids = new Set(allowedStudentIds(user, db));
      const rows = [['Aluno', 'Matrícula', 'Turma', 'Tipo', 'Data/Hora', 'Método']];
      db.attendance
        .filter((r) => ids.has(r.studentId) && range.inRange(r.timestamp) &&
          (!range.classId || studentById(db, r.studentId)?.classId === range.classId) &&
          (!range.studentId || r.studentId === range.studentId) && (!range.type || r.type === range.type))
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

    // -------------------------------------------------------------------------
    // Comunicação interna
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && url.pathname === '/api/messages/conversations') {
      const visible = (db.messages || [])
        .filter(message => message.fromUserId === user.id || message.toUserId === user.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const map = new Map();
      for (const message of visible) {
        const peerId = message.fromUserId === user.id ? message.toUserId : message.fromUserId;
        const peer = userById(db, peerId);
        if (!peer) continue;
        if (!map.has(peerId)) map.set(peerId, { peer: directoryUser(peer), messages: [], lastAt: message.createdAt });
        const conversation = map.get(peerId);
        conversation.messages.push({
          id: message.id, text: message.text, createdAt: message.createdAt,
          ownMessage: message.fromUserId === user.id,
        });
        if (message.createdAt > conversation.lastAt) conversation.lastAt = message.createdAt;
      }
      return json(res, 200, { conversations: [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)) });
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

    // -------------------------------------------------------------------------
    // Validação acadêmica
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Gestão: auditoria, turmas, responsáveis, convites e restauração da demo
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && url.pathname === '/api/audit') {
      if (!canViewAudit(user.role)) return json(res, 403, { error: 'Perfil sem permissão para auditoria.' });
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const userId = url.searchParams.get('userId') || '';
      const action = String(url.searchParams.get('action') || '').trim().toUpperCase();
      const q = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase('pt-BR');
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if ((from && !iso.test(from)) || (to && !iso.test(to)) || (from && to && from > to)) {
        return json(res, 400, { error: 'Período de auditoria inválido.' });
      }
      const rows = (db.audit || [])
        .filter(event => !from || dateKey(event.createdAt) >= from)
        .filter(event => !to || dateKey(event.createdAt) <= to)
        .filter(event => !userId || event.userId === userId)
        .filter(event => !action || String(event.action || '').toUpperCase().includes(action))
        .map(event => ({ ...event, userName: event.userId ? (userById(db, event.userId)?.name || 'Sistema') : 'Sistema' }))
        .filter(event => !q || [event.userName, event.action, event.entity, event.details, event.entityId].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 300);
      const actions = [...new Set((db.audit || []).map(event => event.action).filter(Boolean))].sort();
      const users = db.users.map(directoryUser);
      return json(res, 200, { rows, filters: { actions, users } });
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
        guardians: db.users.filter(item => item.role === 'RESPONSAVEL').map(item => {
          const linkedStudents = (item.studentIds || []).map(id => studentById(db, id)).filter(Boolean);
          return {
            id: item.id, name: item.name, email: item.email, phone: item.phone || '', cpfMasked: maskCpf(item.cpf), status: item.status,
            studentIds: item.studentIds || [],
            students: linkedStudents.map(student => ({ id: student.id, name: student.name, className: className(db, student.classId), status: student.status })),
          };
        }),
        invitations: (db.guardianInvitations || []).filter(item => item.status === 'PENDENTE').map(item => ({
          ...guardianInvitationView(item),
          students: (item.studentIds || []).map(id => studentById(db, id)).filter(Boolean).map(student => ({ id: student.id, name: student.name, className: className(db, student.classId) })),
          daysRemaining: Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 86400000)),
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
      resetDatabase();
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


module.exports = {
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
