const fs=require('fs');const path=require('path');fs.copyFileSync(path.join(__dirname,'data','db.seed.json'),path.join(__dirname,'data','db.json'));console.log('Base de apresentação restaurada.');
