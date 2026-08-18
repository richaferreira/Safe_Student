const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword } = require('../lib/security');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-test-'));
const dbPath = path.join(tempDir, 'db.json');
process.env.SS_DB_PATH = dbPath;
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
process.env.NODE_ENV = 'test';

function seed() {
  return {
    school: { id: 'school_demo', name: 'Escola Teste', city: 'Saquarema - RJ', mode: 'DADOS DE DEMONSTRAÇÃO' },
    users: [
      { id: 'resp1', name: 'Responsável 1', email: 'responsavel@demo.com', passwordHash: hashPassword('demo123', 'resp-test-salt01'), role: 'RESPONSAVEL', studentIds: ['s1'], status: 'ATIVO' },
      { id: 'resp2', name: 'Responsável 2', email: 'outro@demo.com', passwordHash: hashPassword('demo123', 'resp-test-salt02'), role: 'RESPONSAVEL', studentIds: ['s2'], status: 'ATIVO' },
      { id: 'port1', name: 'Portaria', email: 'portaria@demo.com', passwordHash: hashPassword('demo123', 'port-test-salt01'), role: 'PORTARIA', studentIds: [], status: 'ATIVO' },
      { id: 'gest1', name: 'Gestão', email: 'gestor@demo.com', passwordHash: hashPassword('demo123', 'gest-test-salt01'), role: 'GESTAO', studentIds: [], status: 'ATIVO' },
    ],
    classes: [{ id: 'c1', name: '6º Ano A', shift: 'Manhã' }],
    students: [
      { id: 's1', name: 'Aluno Um', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO' },
      { id: 's2', name: 'Aluno Dois', enrollment: '2026-002', classId: 'c1', token: 'SS-ALU002', status: 'ATIVO' },
    ],
    attendance: [], notifications: [], messages: [], audit: [],
    feedback: [{ id: 'demo', userId: 'resp1', profile: 'Responsável', score: 5, comment: 'Ilustrativo', createdAt: '2026-06-18T14:20:00.000Z' }],
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

test('health funciona sem autenticação', async () => {
  const { res, body } = await request('/api/health');
  assert.equal(res.status, 200); assert.equal(body.ok, true); assert.equal(body.timeZone, 'America/Sao_Paulo');
});

test('login inválido retorna 401', async () => {
  const { res } = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'responsavel@demo.com', password: 'errada' }) });
  assert.equal(res.status, 401);
});

test('responsável não pode registrar presença', async () => {
  const token = await login('responsavel@demo.com');
  const { res } = await request('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }) });
  assert.equal(res.status, 403);
});

test('portaria registra entrada e bloqueia segunda entrada', async () => {
  const token = await login('portaria@demo.com');
  const first = await request('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }) });
  assert.equal(first.res.status, 201); assert.equal(first.body.notified, 1);
  const second = await request('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ token: 'SS-ALU001', type: 'ENTRADA' }) });
  assert.equal(second.res.status, 409);
});

test('responsável não envia mensagem a outro responsável manipulando a API', async () => {
  const token = await login('responsavel@demo.com');
  const directory = await request('/api/directory', { headers: auth(token) });
  assert.equal(directory.body.people.some((p) => p.id === 'resp2'), false);
  const send = await request('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ toUserId: 'resp2', text: 'Tentativa indevida' }) });
  assert.equal(send.res.status, 403);
});

test('CSV exige autenticação', async () => {
  const noAuth = await request('/api/reports.csv'); assert.equal(noAuth.res.status, 401);
  const token = await login('responsavel@demo.com');
  const yes = await request('/api/reports.csv', { headers: auth(token) });
  assert.equal(yes.res.status, 200); assert.match(yes.res.headers.get('content-type'), /text\/csv/);
});

test('feedback separa dados ilustrativos de evidência coletada', async () => {
  const token = await login('responsavel@demo.com');
  const post = await request('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ profile: 'Responsável', scenario: 'Consultar entrada do aluno', success: true, timeSeconds: 18, score: 5, comment: 'Fluxo claro.' }) });
  assert.equal(post.res.status, 201);
  const get = await request('/api/feedback', { headers: auth(token) });
  assert.equal(get.body.total, 1); assert.equal(get.body.demoSeedCount, 1); assert.equal(get.body.successRate, 100); assert.equal(get.body.avgTimeSeconds, 18);
});

test('somente gestão exporta CSV de validação', async () => {
  const resp = await login('responsavel@demo.com');
  assert.equal((await request('/api/feedback.csv', { headers: auth(resp) })).res.status, 403);
  const gest = await login('gestor@demo.com');
  const allowed = await request('/api/feedback.csv', { headers: auth(gest) });
  assert.equal(allowed.res.status, 200); assert.match(allowed.body, /Cenário/);
});
