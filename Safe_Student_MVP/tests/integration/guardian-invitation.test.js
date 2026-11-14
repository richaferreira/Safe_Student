/**
 * RN-16 do documento 02: o convite de responsável tem código de uso único, prazo de
 * validade e situação PENDENTE, UTILIZADO ou REVOGADO. Convite expirado, revogado ou já
 * utilizado não ativa conta.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword } = require('../../src/services/security');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-rules-test-'));
const dbPath = path.join(tempDir, 'safe_student_rules_test.db');
process.env.SS_DB_PATH = dbPath;
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
process.env.NODE_ENV = 'test';

const { initializeDatabaseFromObject, readDatabase } = require('../../src/database/repository');

const { digestCode } = require('../../src/utils/validation');

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

function invitation(id, email, code, status, expiresAt) {
  return { id, name: `Responsável ${id}`, email, phone: '', relationship: 'Responsável legal', studentIds: ['s1'], status, codeHash: digestCode(code), expiresAt };
}

function testSeed() {
  return {
    school: { id: 'school_demo', name: 'Escola Teste', city: 'Saquarema - RJ', mode: 'TEST' },
    users: [
      { id: 'gest1', name: 'Gestor Teste', email: 'gestor@demo.com', passwordHash: hashPassword('demo123'), role: 'GESTAO', studentIds: [], status: 'ATIVO' },
    ],
    classes: [{ id: 'c1', name: '6º Ano A', shift: 'Manhã', status: 'ATIVO' }],
    students: [{ id: 's1', name: 'Estudante 1', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO' }],
    attendance: [], notifications: [], messages: [], audit: [], feedback: [],
    guardianInvitations: [
      invitation('inv_exp', 'expirado@demo.com', 'EXPIRADO1', 'PENDENTE', PAST),
      invitation('inv_rev', 'revogado@demo.com', 'REVOGADO1', 'REVOGADO', FUTURE),
      invitation('inv_ok', 'valido@demo.com', 'VALIDO001', 'PENDENTE', FUTURE),
    ],
  };
}

const { server, sessions } = require('../../server');
let base;

test.before(async () => {
  initializeDatabaseFromObject(testSeed());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function loginAs(email) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo123' }),
  });
  return (await res.json()).token;
}
async function call(method, url, token, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function register(email, code) {
  return fetch(`${base}/api/guardian/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, password: 'Senha12345', confirmPassword: 'Senha12345' }),
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }));
}

test('RN-16: convite expirado não ativa a conta', async () => {
  const res = await register('expirado@demo.com', 'EXPIRADO1');
  assert.equal(res.status, 400);
  assert.match(res.data.error, /inválido ou expirado/i);
  assert.ok(!readDatabase().users.some((u) => u.email === 'expirado@demo.com'));
});

test('RN-16: convite revogado não ativa a conta', async () => {
  const res = await register('revogado@demo.com', 'REVOGADO1');
  assert.equal(res.status, 400);
  assert.ok(!readDatabase().users.some((u) => u.email === 'revogado@demo.com'));
});

test('RN-16: convite válido ativa a conta e passa a UTILIZADO', async () => {
  const res = await register('valido@demo.com', 'VALIDO001');
  assert.equal(res.status, 201);
  assert.equal(res.data.childrenLinked, 1);
  const inv = readDatabase().guardianInvitations.find((i) => i.id === 'inv_ok');
  assert.equal(inv.status, 'UTILIZADO');
  assert.equal(inv.codeHash, null);
});

test('RN-16: o código de um convite já utilizado não funciona de novo', async () => {
  const res = await register('valido@demo.com', 'VALIDO001');
  assert.equal(res.status, 400);
  assert.match(res.data.error, /inválido ou expirado/i);
});
