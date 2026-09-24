/**
 * Importa uma base JSON antiga para o SQLite.
 *
 * Uso no PowerShell:
 *   node scripts/migrate-json-to-sqlite.js data/db.seed.json
 *
 * A importação passa pelas mesmas tabelas, chaves e transação usadas pelo MVP.
 */
const fs = require('fs');
const path = require('path');
const { initializeDatabaseFromObject } = require('../src/database/repository');
const { config } = require('../src/config');

const input = process.argv[2] || config.seedJsonPath;
const jsonPath = path.resolve(input);
if (!fs.existsSync(jsonPath)) {
  console.error(`Arquivo JSON não encontrado: ${jsonPath}`);
  process.exit(1);
}

const aggregate = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
initializeDatabaseFromObject(aggregate);
console.log(`Migração concluída: ${jsonPath} -> ${config.dbPath}`);
