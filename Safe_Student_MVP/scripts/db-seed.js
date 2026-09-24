/** Carrega os dados fictícios de demonstração no banco SQLite. */
const { seedDatabase } = require('../src/database/repository');
const { config } = require('../src/config');

seedDatabase();
console.log(`Dados de demonstração carregados em: ${config.dbPath}`);
