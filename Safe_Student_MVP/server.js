/**
 * Ponto de entrada do backend do Safe Student.
 *
 * A inicialização do servidor fica pequena de propósito. Toda a regra HTTP está
 * em src/app.js e os demais módulos ficam separados por responsabilidade.
 */
const http = require('http');
const { config } = require('./src/config');
const app = require('./src/app');
const { ensureDatabase } = require('./src/database/repository');

const server = http.createServer(app.handler);

if (require.main === module) {
  // Garante que o schema e o seed estejam disponíveis antes de aceitar acessos.
  ensureDatabase();
  server.listen(config.port, () => {
    console.log(`Safe Student MVP em http://localhost:${config.port}`);
  });
}

module.exports = {
  server,
  ...app,
};
