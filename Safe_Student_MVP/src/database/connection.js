/**
 * Conexão SQLite do Safe Student.
 *
 * O projeto usa o módulo `node:sqlite`, disponível nas versões atuais do Node.js.
 * Mantemos a abertura da conexão neste arquivo para que o restante da aplicação
 * não dependa diretamente da tecnologia de banco escolhida.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('../config');

function openDatabase(databasePath = config.dbPath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);

  // As chaves estrangeiras não são habilitadas por padrão no SQLite.
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA busy_timeout = 5000;');

  return database;
}

module.exports = { openDatabase };
