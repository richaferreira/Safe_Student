/**
 * Fachada de persistência do Safe Student.
 *
 * Os serviços atuais usam readDatabase/writeDatabase. Mantemos esse contrato
 * para que a troca de JSON por SQLite não obrigue a reescrever as regras de
 * negócio já testadas. Internamente, os dados agora vivem em tabelas relacionais.
 */
const fs = require('fs');
const { config } = require('../config');
const { openDatabase } = require('./connection');
const { runMigrations } = require('./migrationRunner');
const { loadAggregate, replaceAggregate } = require('./repositories/databaseRepository');

function readSeedJson() {
  return JSON.parse(fs.readFileSync(config.seedJsonPath, 'utf8'));
}

function ensureDatabase() {
  runMigrations(config.dbPath);
  const database = openDatabase(config.dbPath);
  try {
    const row = database.prepare('SELECT COUNT(*) AS total FROM school').get();
    if (Number(row.total) === 0) replaceAggregate(database, readSeedJson());
  } finally {
    database.close();
  }
}

function readDatabase() {
  ensureDatabase();
  const database = openDatabase(config.dbPath);
  try {
    return loadAggregate(database);
  } finally {
    database.close();
  }
}

function writeDatabase(aggregate) {
  ensureDatabase();
  const database = openDatabase(config.dbPath);
  try {
    replaceAggregate(database, aggregate);
  } finally {
    database.close();
  }
}

function initializeDatabaseFromObject(aggregate) {
  runMigrations(config.dbPath);
  const database = openDatabase(config.dbPath);
  try {
    replaceAggregate(database, aggregate);
  } finally {
    database.close();
  }
  return aggregate;
}

function seedDatabase() {
  return initializeDatabaseFromObject(readSeedJson());
}

function resetDatabase() {
  // Remove também WAL/SHM para garantir uma restauração limpa em demonstrações.
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${config.dbPath}${suffix}`, { force: true });
  }
  runMigrations(config.dbPath);
  return seedDatabase();
}

module.exports = {
  ensureDatabase,
  readDatabase,
  writeDatabase,
  initializeDatabaseFromObject,
  seedDatabase,
  resetDatabase,
};
