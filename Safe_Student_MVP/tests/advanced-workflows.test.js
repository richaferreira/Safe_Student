const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-advanced-'));
const dbPath = path.join(tempDir, 'db.json');
process.env.SS_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
const seed = fs.readFileSync(path.join(__dirname, '../data/db.seed.json'));
fs.writeFileSync(dbPath, seed);

const { server, sessions, loginAttempts, passwordResets } = require('../server');
let base;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test.beforeEach(() => {
  fs.writeFileSync(dbPath, seed);
  sessions.clear();
  loginAttempts.clear();
  passwordResets.clear();
});

async function raw(route, options = {}) {
  return fetch(`${base}${route}`, options);
}

async function request(route, options = {}) {
  const res = await raw(route, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { res, body };
}

async function login(email = 'gestor@demo.com') {
  const result = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo123' }),
  });
  assert.equal(result.res.status, 200);
  return { token: result.body.token, cookie: result.res.headers.get('set-cookie') };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function schoolDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

test('sessão funciona por cookie HttpOnly sem expor token ao JavaScript', async () => {
  const logged = await login('gestor@demo.com');
  assert.match(logged.cookie || '', /ss_session=/);
  assert.match(logged.cookie || '', /HttpOnly/i);
  assert.match(logged.cookie || '', /SameSite=Strict/i);
  const cookie = (logged.cookie || '').split(';')[0];
  const me = await request('/api/me', { headers: { Cookie: cookie } });
  assert.equal(me.res.status, 200);
  assert.equal(me.body.user.role, 'GESTAO');
  const logout = await request('/api/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.res.status, 200);
  assert.match(logout.res.headers.get('set-cookie') || '', /Max-Age=0/i);
});

test('gestão cadastra aluno com múltiplos responsáveis na mesma operação', async () => {
  const manager = await login();
  const payload = {
    name: 'Clara Multi Responsável',
    enrollment: 'MULTI-2026-01',
    classId: 'c2',
    guardians: [
      { mode: 'existing', guardianId: 'u_resp_1' },
      {
        mode: 'new',
        name: 'Paulo Responsável Novo',
        email: 'paulo.novo@example.com',
        phone: '(22) 99999-2211',
        relationship: 'Pai',
      },
    ],
  };
  const created = await request('/api/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(manager.token) }, body: JSON.stringify(payload),
  });
  assert.equal(created.res.status, 201);
  assert.equal(created.body.guardianLinkedCount, 1);
  assert.equal(created.body.invitations.length, 1);
  assert.ok(created.body.invitations[0].activationCode.length >= 20);

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const saved = db.students.find((student) => student.enrollment === payload.enrollment);
  assert.ok(saved);
  assert.equal(db.users.find((user) => user.id === 'u_resp_1').studentIds.includes(saved.id), true);
  const invite = db.guardianInvitations.find((item) => item.email === 'paulo.novo@example.com');
  assert.ok(invite);
  assert.equal(invite.studentIds.includes(saved.id), true);
  assert.equal(Object.hasOwn(invite, 'activationCode'), false);
});

test('portaria consulta estado operacional e API aceita somente próxima ação válida', async () => {
  const gate = await login('portaria@demo.com');
  const first = await request('/api/attendance/status?token=SS-ALU001', { headers: auth(gate.token) });
  assert.equal(first.res.status, 200);
  assert.equal(first.body.status.state, 'SEM_REGISTRO');
  assert.equal(first.body.status.nextType, 'ENTRADA');

  const entry = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA', method: 'QR_CAMERA' }),
  });
  assert.equal(entry.res.status, 201);
  assert.equal(entry.body.record.method, 'QR_CAMERA');
  assert.equal(entry.body.status.state, 'DENTRO');
  assert.equal(entry.body.status.nextType, 'SAIDA');

  const duplicate = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA', method: 'TOKEN_MANUAL' }),
  });
  assert.equal(duplicate.res.status, 409);

  const exit = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'SAIDA', method: 'QR_TOKEN' }),
  });
  assert.equal(exit.res.status, 201);
  assert.equal(exit.body.status.state, 'FORA');
  assert.equal(exit.body.status.nextType, 'ENTRADA');
});

test('remoção de vínculo revoga também o acesso a notificações antigas daquele aluno', async () => {
  const gate = await login('portaria@demo.com');
  const manager = await login('gestor@demo.com');
  const guardian = await login('responsavel@demo.com');

  const entry = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }),
  });
  assert.equal(entry.res.status, 201);
  const before = await request('/api/notifications?studentId=s1', { headers: auth(guardian.token) });
  assert.equal(before.res.status, 200);
  assert.ok(before.body.notifications.length >= 1);
  const notificationId = before.body.notifications[0].id;

  const unlinked = await request('/api/links', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json', ...auth(manager.token) },
    body: JSON.stringify({ studentId: 's1', guardianId: 'u_resp_1' }),
  });
  assert.equal(unlinked.res.status, 200);

  const after = await request('/api/notifications?studentId=s1', { headers: auth(guardian.token) });
  assert.equal(after.res.status, 200);
  assert.deepEqual(after.body.notifications, []);
  const mark = await request(`/api/notifications/${notificationId}`, { method: 'PATCH', headers: auth(guardian.token) });
  assert.equal(mark.res.status, 404);
});

test('relatório e CSV compartilham exatamente os mesmos filtros de aluno e tipo', async () => {
  const gate = await login('portaria@demo.com');
  const manager = await login();
  for (const [token, type] of [['SS-ALU001', 'ENTRADA'], ['SS-ALU002', 'ENTRADA'], ['SS-ALU002', 'SAIDA']]) {
    const result = await request('/api/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
      body: JSON.stringify({ token, type }),
    });
    assert.equal(result.res.status, 201);
  }
  const today = schoolDate();
  const query = `from=${today}&to=${today}&studentId=s2&type=SAIDA`;
  const report = await request(`/api/reports?${query}`, { headers: auth(manager.token) });
  assert.equal(report.res.status, 200);
  assert.equal(report.body.records.length, 1);
  assert.equal(report.body.records[0].studentId, 's2');
  assert.equal(report.body.records[0].type, 'SAIDA');
  assert.deepEqual(report.body.totals, { students: 1, records: 1, entradas: 0, saidas: 1 });

  const exported = await request(`/api/reports.csv?${query}`, { headers: auth(manager.token) });
  assert.equal(exported.res.status, 200);
  const lines = exported.body.trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.match(exported.body, /Beatriz Costa/);
  assert.match(exported.body, /SAIDA/);
  assert.doesNotMatch(exported.body, /Lucas Costa/);
});

test('mensagens podem ser consultadas por conversa sem vazar outro destinatário', async () => {
  const guardian = await login('responsavel@demo.com');
  const directory = await request('/api/directory', { headers: auth(guardian.token) });
  const gate = directory.body.people.find((p) => p.role === 'PORTARIA');
  const manager = directory.body.people.find((p) => p.role === 'GESTAO');
  assert.ok(gate && manager);

  for (const [toUserId, text] of [[gate.id, 'Mensagem somente para a portaria.'], [manager.id, 'Mensagem somente para a gestão.']]) {
    const sent = await request('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(guardian.token) },
      body: JSON.stringify({ toUserId, text }),
    });
    assert.equal(sent.res.status, 201);
  }
  const thread = await request(`/api/messages?withUserId=${encodeURIComponent(gate.id)}`, { headers: auth(guardian.token) });
  assert.equal(thread.res.status, 200);
  assert.equal(thread.body.peer.id, gate.id);
  assert.equal(thread.body.messages.every((message) => [message.fromUserId, message.toUserId].includes(gate.id)), true);
  assert.equal(thread.body.messages.some((message) => message.text.includes('gestão')), false);
});

test('auditoria pode ser filtrada por ação, ator, período e termo', async () => {
  const gate = await login('portaria@demo.com');
  const manager = await login();
  const record = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(gate.token) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }),
  });
  assert.equal(record.res.status, 201);
  const today = schoolDate();
  const filtered = await request(`/api/audit?action=REGISTRAR_ENTRADA&userId=u_port_1&from=${today}&to=${today}&q=Lucas`, { headers: auth(manager.token) });
  assert.equal(filtered.res.status, 200);
  assert.ok(filtered.body.rows.length >= 1);
  assert.equal(filtered.body.rows.every((event) => event.action === 'REGISTRAR_ENTRADA' && event.userId === 'u_port_1'), true);
  assert.equal(filtered.body.rows.every((event) => String(event.details).includes('Lucas')), true);
});

test('frontend avançado entrega wizard, QR, conversas e filtros sem handlers inline', async () => {
  const page = await request('/');
  const app = await request('/app.js');
  const css = await request('/school-experience.css');
  assert.equal(page.res.status, 200);
  assert.match(page.body, /Cadastrar aluno e responsáveis/);
  assert.match(page.body, /id="startQrScannerBtn"/);
  assert.match(page.body, /id="conversationContacts"/);
  assert.match(page.body, /id="auditSearch"/);
  assert.doesNotMatch(page.body, /onclick=/i);
  assert.equal(app.res.status, 200);
  assert.match(app.body, /BarcodeDetector/);
  assert.match(app.body, /credentials:\s*'same-origin'/);
  assert.equal(css.res.status, 200);
  assert.match(css.body, /\.portaria-layout/);
  assert.match(css.body, /\.conversation-shell/);
  assert.match(css.body, /\.permission-hidden/);
});
