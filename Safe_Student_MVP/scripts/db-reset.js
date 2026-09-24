/**
 * Recria o banco SQLite da demonstração.
 * Este comando apaga os dados locais do arquivo safe_student.db.
 */
const { resetDatabase } = require('../src/database/repository');
const { config } = require('../src/config');

resetDatabase();
console.log(`Banco de demonstração restaurado em: ${config.dbPath}`);
