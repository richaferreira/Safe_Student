/**
 * Testes de integração para a Gestão de Turmas e integridade referencial.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword } = require('../../src/services/security');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-classes-test-'));
const dbPath = path.join(tempDir, 'safe_student_classes_test.db');
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
      { id: 'resp1', name: 'Responsável Teste', email: 'resp@demo.com', passwordHash: hashPassword('demo123'), role: 'RESPONSAVEL', studentIds: ['s1'], status: 'ATIVO' },
    ],
    classes: [
      { id: 'c1', name: '6º Ano A', shift: 'Manhã', status: 'ATIVO' },
      { id: 'c2', name: '7º Ano B', shift: 'Tarde', status: 'INATIVO' },
    ],
    students: [
      { id: 's1', name: 'Estudante 1', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO' },
    ],
    attendance: [],
    notifications: [],
    messages: [],
    audit: [],
    feedback: [],
    guardianInvitations: [],
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
  const data = await res.json();
  return data.token;
}

test('GET /api/classes retorna turmas com contadores e status para a Gestão', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await fetch(`${base}/api/classes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(Array.isArray(data.classes), true);
  const c1 = data.classes.find((c) => c.id === 'c1');
  assert.ok(c1);
  assert.equal(c1.name, '6º Ano A');
  assert.equal(c1.shift, 'Manhã');
  assert.equal(c1.status, 'ATIVO');
  assert.equal(c1.studentCount, 1);
});

test('POST /api/classes cadastra nova turma com sucesso', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await fetch(`${base}/api/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: '8º Ano C', shift: 'Integral', status: 'ATIVO' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.class);
  assert.equal(data.class.name, '8º Ano C');
  assert.equal(data.class.shift, 'Integral');
  assert.equal(data.class.status, 'ATIVO');
});

test('POST /api/classes impede duplicidade de nome de turma', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await fetch(`${base}/api/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: '6º Ano A', shift: 'Manhã' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /Já existe/);
});

test('PATCH /api/classes/:id atualiza dados e status da turma', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await fetch(`${base}/api/classes/c2`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'ATIVO', shift: 'Manhã' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.class.status, 'ATIVO');
  assert.equal(data.class.shift, 'Manhã');
});

test('Portaria não tem permissão para cadastrar turma (RBAC)', async () => {
  const token = await loginAs('portaria@demo.com');
  const res = await fetch(`${base}/api/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: 'Turma Não Autorizada', shift: 'Manhã' }),
  });
  assert.equal(res.status, 403);
});

test('DELETE /api/classes/:id bloqueia exclusão de turma com alunos matriculados (FK)', async () => {
  const token = await loginAs('gestor@demo.com');
  const res = await fetch(`${base}/api/classes/c1`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /aluno.*vinculado/i);
});

test('DELETE /api/classes/:id permite exclusão de turma sem alunos', async () => {
  const token = await loginAs('gestor@demo.com');
  // Cria uma turma vazia
  const createRes = await fetch(`${base}/api/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: 'Turma Temporária', shift: 'Noite' }),
  });
  const created = await createRes.json();
  const id = created.class.id;

  const deleteRes = await fetch(`${base}/api/classes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleteRes.status, 200);
});

test('POST /api/students rejeita matrícula em turma inativa', async () => {
  const token = await loginAs('gestor@demo.com');
  // Inativa c2 primeiro
  await fetch(`${base}/api/classes/c2`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'INATIVO' }),
  });

  const res = await fetch(`${base}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Aluno Novo Teste',
      enrollment: '2026-999',
      classId: 'c2', // turma inativa
      guardianId: 'resp1',
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /turma selecionada está inativa/);
});
