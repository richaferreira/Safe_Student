// Uso (dentro de Safe_Student_MVP):
//   node inspecionar-banco.js                 -> lista as tabelas, quantidade de registros e colunas
//   node inspecionar-banco.js students        -> colunas, chaves estrangeiras e 10 registros da tabela
//   node inspecionar-banco.js students 50     -> mostra 50 registros
// Banco usado: SS_DB_PATH ou data/safe_student.db. Precisa de Node 22.13 ou mais novo.
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const file = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'safe_student.db');
const db = new DatabaseSync(file, { readOnly: true });
const [table, limit = '10'] = process.argv.slice(2);
console.log(`Banco: ${file}\n`);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);

if (!table) {
  console.table(tables.map((name) => ({
    tabela: name,
    registros: db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n,
    colunas: db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name + (c.pk ? ' (PK)' : '')).join(', '),
  })));
} else {
  if (!tables.includes(table)) { console.error(`Tabela "${table}" não existe. Tabelas: ${tables.join(', ')}`); process.exit(1); }
  console.log(`Colunas de ${table}`);
  console.table(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => ({ coluna: c.name, tipo: c.type, obrigatoria: c.notnull ? 'sim' : 'não', padrao: c.dflt_value, pk: c.pk ? 'sim' : '' })));
  const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
  if (fks.length) { console.log('Chaves estrangeiras'); console.table(fks.map((f) => ({ coluna: f.from, referencia: `${f.table}.${f.to}`, ao_excluir: f.on_delete }))); }
  console.log(`Primeiros ${limit} registros`);
  console.table(db.prepare(`SELECT * FROM "${table}" LIMIT ${Number(limit) || 10}`).all());
}
