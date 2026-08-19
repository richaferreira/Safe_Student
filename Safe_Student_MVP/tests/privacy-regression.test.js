const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword } = require('../lib/security');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-privacy-'));
const dbPath = path.join(tempDir, 'db.json');
process.env.SS_DB_PATH = dbPath;
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
process.env.NODE_ENV = 'test';

function seed() {
  return {
    school: { id: 'school_demo', name: 'Escola Teste', city: 'Saquarema - RJ', mode: 'DEMO' },
    users: [
      { id: 'resp1', name: 'Responsável 1', email: 'responsavel@demo.com', passwordHash: hashPassword('demo123', 'resp-privacy-01'), role: 'RESPONSAVEL', studentIds: ['s1'], status: 'ATIVO' },
      { id: 'resp2', name: 'Responsável 2', email: 'outro@demo.com', passwordHash: hashPassword('demo123', 'resp-privacy-02'), role: 'RESPONSAVEL', studentIds: ['s2'], status: 'ATIVO' },
      { id: 'port1', name: 'Portaria', email: 'portaria@demo.com', passwordHash: hashPassword('demo123', 'port-privacy-01'), role: 'PORTARIA', studentIds: [], status: 'ATIVO' },
      { id: 'gest1', name: 'Gestão', email: 'gestor@demo.com', passwordHash: hashPassword('demo123', 'gest-privacy-01'), role: 'GESTAO', studentIds: [], status: 'ATIVO' },
    ],
    classes: [{ id: 'c1', name: '6º Ano A', shift: 'Manhã' }],
    students: [
      { id: 's1', name: 'Aluno Um', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO' },
      { id: 's2', name: 'Aluno Dois', enrollment: '2026-002', classId: 'c1', token: 'SS-ALU002', status: 'ATIVO' },
    ],
    attendance: [], notifications: [], messages: [], audit: [],
    feedback: [{ id: 'demo', userId: 'resp1', profile: 'Responsável', scenario: 'Demo', success: true, timeSeconds: 10, score: 5, comment: 'Ilustrativo', source: 'DEMO_SEED', createdAt: '2026-06-18T14:20:00.000Z' }],
  };
}

function resetDb() { fs.writeFileSync(dbPath, JSON.stringify(seed(), null, 2)); }
resetDb();
const { server, sessions, loginAttempts } = require('../server');
let base;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test.beforeEach(() => { resetDb(); sessions.clear(); loginAttempts.clear(); });

async function request(url, options = {}) {
  const res = await fetch(`${base}${url}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { res, body };
}

async function login(email) {
  const { res, body } = await request('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo123' }),
  });
  assert.equal(res.status, 200);
  return body.token;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('diretório expõe somente dados mínimos do destinatário', async () => {
  const token = await login('responsavel@demo.com');
  const { body } = await request('/api/directory', { headers: auth(token) });
  assert.ok(body.people.length > 0);
  for (const person of body.people) {
    assert.equal(Object.hasOwn(person, 'passwordHash'), false);
    assert.equal(Object.hasOwn(person, 'email'), false);
    assert.equal(Object.hasOwn(person, 'studentIds'), false);
  }
});

test('gestão não lê mensagem privada entre outros usuários', async () => {
  const resp = await login('responsavel@demo.com');
  const sent = await request('/api/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(resp) },
    body: JSON.stringify({ toUserId: 'port1', text: 'Mensagem privada entre responsável e portaria.' }),
  });
  assert.equal(sent.res.status, 201);

  const gest = await login('gestor@demo.com');
  const messages = await request('/api/messages', { headers: auth(gest) });
  assert.equal(messages.body.messages.some((m) => m.id === sent.body.message.id), false);
});

test('dashboard da gestão não recebe notificação destinada ao responsável', async () => {
  const port = await login('portaria@demo.com');
  const attendance = await request('/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(port) },
    body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }),
  });
  assert.equal(attendance.res.status, 201);

  const gest = await login('gestor@demo.com');
  const dashboard = await request('/api/dashboard', { headers: auth(gest) });
  assert.equal(dashboard.body.notifications.length, 0);
});

test('CSV de validação exporta apenas evidências coletadas, sem DEMO_SEED', async () => {
  const resp = await login('responsavel@demo.com');
  await request('/api/feedback', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(resp) },
    body: JSON.stringify({ profile: 'Responsável', scenario: 'Consulta', success: true, timeSeconds: 20, score: 4, comment: 'Coleta real de teste.' }),
  });
  const gest = await login('gestor@demo.com');
  const csv = await request('/api/feedback.csv', { headers: auth(gest) });
  assert.equal(csv.res.status, 200);
  assert.match(csv.body, /Coleta real de teste/);
  assert.doesNotMatch(csv.body, /Ilustrativo/);
  assert.doesNotMatch(csv.body, /DEMO_SEED/);
});

test('restauração da demo gera evento de auditoria antes de invalidar a sessão', async () => {
  const gest = await login('gestor@demo.com');
  const reset = await request('/api/demo/reset', { method: 'POST', headers: auth(gest) });
  assert.equal(reset.res.status, 200);
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert.equal(db.audit.some((a) => a.action === 'RESTAURAR_DEMO' && a.userId === 'gest1'), true);
});
