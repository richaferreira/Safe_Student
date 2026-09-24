/**
 * Configurações centrais do Safe Student.
 *
 * Mantemos os valores de ambiente em um único arquivo para evitar números
 * e caminhos espalhados pelo código. Isso facilita testes e futuras mudanças.
 */
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const config = {
  port: Number(process.env.PORT || 3000),
  timeZone: process.env.SS_TIME_ZONE || 'America/Sao_Paulo',
  sessionTtlMs: Number(process.env.SS_SESSION_TTL_MS || 2 * 60 * 60 * 1000),
  maxBodyBytes: 1_000_000,
  seedJsonPath: path.join(ROOT_DIR, 'data', 'db.seed.json'),
  migrationsDir: path.join(ROOT_DIR, 'src', 'database', 'migrations'),
  dbPath: process.env.SS_DB_PATH || path.join(ROOT_DIR, 'data', 'safe_student.db'),
  publicDir: path.join(ROOT_DIR, 'public'),
};

module.exports = { ROOT_DIR, config };
