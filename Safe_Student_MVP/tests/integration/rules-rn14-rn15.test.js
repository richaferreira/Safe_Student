/**
 * Testes das regras RN-14 e RN-15 do documento 02: turma inativa não recebe transferência
 * e o aluno nunca fica sem responsável.
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

function testSeed() {
  return {
    school: { id: 'school_demo', name: 'Escola Teste', city: 'Saquarema - RJ', mode: 'TEST' },
    users: [
      { id: 'gest1', name: 'Gestor Teste', email: 'gestor@demo.com', passwordHash: hashPassword('demo123'), role: 'GESTAO', studentIds: [], status: 'ATIVO' },
      { id: 'port1', name: 'Porteiro Teste', email: 'portaria@demo.com', passwordHash: hashPassword('demo123'), role: 'PORTARIA', studentIds: [], status: 'ATIVO' },
      { id: 'resp2', name: 'Segundo Responsável', email: 'resp2@demo.com', passwordHash: hashPassword('demo123'), role: 'RESPONSAVEL', studentIds: ['s2'], status: 'ATIVO' },
      { id: 'resp1', name: 'Responsável Teste', email: 'resp@demo.com', passwordHash: hashPassword('demo123'), role: 'RESPONSAVEL', studentIds: ['s1', 's2', 's3'], status: 'ATIVO' },
    ],
    classes: [
      { id: 'c1', name: '6º Ano A', shift: 'Manhã', status: 'ATIVO' },
      { id: 'c2', name: '7º Ano B', shift: 'Tarde', status: 'INATIVO' },
    ],
    students: [
      { id: 's1', name: 'Estudante 1', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO' },
      { id: 's2', name: 'Estudante 2', enrollment: '2026-002', classId: 'c1', token: 'SS-ALU002', status: 'ATIVO' },
      { id: 's3', name: 'Estudante 3', enrollment: '2026-003', classId: 'c1', token: 'SS-ALU003', status: 'ATIVO' },
    ],
    attendance: [],
    notifications: [],
    messages: [],
    audit: [],
    feedback: [],
    guardianInvitations: [
      { id: 'inv3', name: 'Convidado', email: 'convidado@demo.com', phone: '', relationship: 'Responsável legal', studentIds: ['s3'], status: 'PENDENTE', codeHash: null, expiresAt: '2099-01-01T00:00:00.000Z' },
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

test('RN-14: editar aluno não permite transferi-lo para turma inativa', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await call('PATCH', '/api/students/s1', token, { name: 'Estudante 1', enrollment: '2026-001', classId: 'c2', status: 'ATIVO' });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /inativa/i);
  assert.equal(readDatabase().students.find((s) => s.id === 's1').classId, 'c1');
});

test('RN-14: editar outros dados do aluno na mesma turma continua permitido', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await call('PATCH', '/api/students/s1', token, { name: 'Estudante Um', enrollment: '2026-001', classId: 'c1', status: 'ATIVO' });
  assert.equal(res.status, 200);
});

test('RN-15: não remove o último responsável de um aluno', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await call('DELETE', '/api/links', token, { guardianId: 'resp1', studentId: 's1' });
  assert.equal(res.status, 409);
  assert.match(res.data.error, /último responsável/i);
  assert.ok(readDatabase().users.find((u) => u.id === 'resp1').studentIds.includes('s1'));
});

test('RN-15: remove o vínculo quando existe outro responsável ativo', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await call('DELETE', '/api/links', token, { guardianId: 'resp1', studentId: 's2' });
  assert.equal(res.status, 200);
});

test('RN-15: remove o vínculo quando há convite pendente para o aluno', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await call('DELETE', '/api/links', token, { guardianId: 'resp1', studentId: 's3' });
  assert.equal(res.status, 200);
});
