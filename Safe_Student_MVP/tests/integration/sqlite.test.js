/**
 * Testes específicos da camada SQLite.
 *
 * Estes cenários não testam telas. Eles verificam se o banco relacional mantém
 * as garantias que o antigo arquivo JSON não conseguia oferecer sozinho.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-sqlite-'));
process.env.SS_DB_PATH = path.join(tempDir, 'safe_student_test.db');
process.env.NODE_ENV = 'test';

const { config } = require('../../src/config');
const { openDatabase } = require('../../src/database/connection');
const { runMigrations } = require('../../src/database/migrationRunner');
const {
  resetDatabase,
  readDatabase,
  writeDatabase,
} = require('../../src/database/repository');

test.beforeEach(() => resetDatabase());
test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test('migrations criam as principais tabelas relacionais', () => {
  runMigrations();
  const db = openDatabase();
  try {
    const names = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all().map((row) => row.name);

    for (const expected of [
      'users', 'students', 'guardian_students', 'attendance',
      'notifications', 'messages', 'audit_log', 'guardian_invitations',
      'guardian_invitation_students', 'schema_migrations',
    ]) {
      assert.equal(names.includes(expected), true, `Tabela ausente: ${expected}`);
    }
  } finally {
    db.close();
  }
});

test('seed cria dados demonstrativos no SQLite', () => {
  const db = readDatabase();
  assert.equal(db.school.id, 'school_demo');
  assert.equal(db.users.length >= 4, true);
  assert.equal(db.students.length >= 4, true);
  assert.equal(db.attendance.length > 0, true);
});

test('SQLite impede matrícula duplicada por restrição UNIQUE', () => {
  const db = openDatabase();
  try {
    const first = db.prepare('SELECT * FROM students LIMIT 1').get();
    assert.throws(() => {
      db.prepare(`
        INSERT INTO students(id, name, enrollment, class_id, token, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('duplicado-id', 'Aluno Duplicado', first.enrollment, first.class_id, 'SS-DUPLICADO', 'ATIVO');
    }, /UNIQUE constraint failed/);
  } finally {
    db.close();
  }
});

test('SQLite impede vínculo com aluno inexistente por chave estrangeira', () => {
  const db = openDatabase();
  try {
    const guardian = db.prepare("SELECT id FROM users WHERE role = 'RESPONSAVEL' LIMIT 1").get();
    assert.throws(() => {
      db.prepare('INSERT INTO guardian_students(guardian_id, student_id) VALUES (?, ?)')
        .run(guardian.id, 'aluno-que-nao-existe');
    }, /FOREIGN KEY constraint failed/);
  } finally {
    db.close();
  }
});

test('gravação agregada é atômica e faz rollback quando há violação', () => {
  const before = readDatabase();
  const broken = structuredClone(before);
  broken.students.push({
    ...broken.students[0],
    id: 'student-duplicado',
    token: 'SS-TOKEN-NOVO',
    // enrollment repetida de propósito para provocar a restrição UNIQUE.
  });

  assert.throws(() => writeDatabase(broken), /UNIQUE constraint failed/);
  const after = readDatabase();
  assert.equal(after.students.length, before.students.length);
  assert.equal(after.students.some((student) => student.id === 'student-duplicado'), false);
});

test('arquivo usado nos testes é realmente SQLite e não JSON renomeado', () => {
  const header = fs.readFileSync(config.dbPath).subarray(0, 16).toString('utf8');
  assert.equal(header, 'SQLite format 3\u0000');
});
