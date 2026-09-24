/** Exibe um resumo simples do banco para demonstração e diagnóstico. */
const { openDatabase } = require('../src/database/connection');
const { runMigrations } = require('../src/database/migrationRunner');
const { config } = require('../src/config');

runMigrations();
const db = openDatabase();
try {
  const tables = ['users', 'students', 'guardian_students', 'attendance', 'notifications', 'messages', 'audit_log', 'guardian_invitations'];
  console.log(`Banco: ${config.dbPath}`);
  for (const table of tables) {
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();
    console.log(`${table.padEnd(28)} ${total}`);
  }
} finally {
  db.close();
}
