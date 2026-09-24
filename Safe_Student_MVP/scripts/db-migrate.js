/** Executa as migrations pendentes do SQLite. */
const { runMigrations } = require('../src/database/migrationRunner');
const { config } = require('../src/config');

runMigrations();
console.log(`Migrations aplicadas em: ${config.dbPath}`);
