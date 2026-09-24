/**
 * Executor simples de migrations SQL.
 *
 * Cada arquivo da pasta migrations representa uma mudança de estrutura.
 * A tabela schema_migrations registra o que já foi aplicado e evita executar
 * a mesma alteração duas vezes.
 */
const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const { openDatabase } = require('./connection');

function migrationFiles() {
  return fs.readdirSync(config.migrationsDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
}

function runMigrations(databasePath = config.dbPath) {
  const database = openDatabase(databasePath);
  try {
    // A primeira tabela precisa existir antes de consultar as migrations aplicadas.
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = new Set(
      database.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version),
    );

    for (const fileName of migrationFiles()) {
      const version = fileName.replace(/\.sql$/i, '');
      if (applied.has(version)) continue;

      const sql = fs.readFileSync(path.join(config.migrationsDir, fileName), 'utf8');
      database.exec('BEGIN IMMEDIATE;');
      try {
        database.exec(sql);
        database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
          .run(version, new Date().toISOString());
        database.exec('COMMIT;');
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    }
  } finally {
    database.close();
  }
}

module.exports = { runMigrations };
