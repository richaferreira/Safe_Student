const fs = require('fs');
const path = require('path');

const seed = path.join(__dirname, 'data', 'db.seed.json');
const target = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.runtime.json');
fs.copyFileSync(seed, target);
console.log(`Base de apresentação restaurada em ${target}.`);
