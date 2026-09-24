/**
 * Funções HTTP reutilizadas pelas rotas da API.
 */
const { config } = require('../config');

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendCsv(res, filename, rows) {
  const escapeCell = (value) => {
    const raw = String(value ?? '');
    // Evita que Excel/LibreOffice interprete conteúdo do CSV como fórmula.
    const safe = /^[\s\x00-\x1f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const body = rows.map((row) => row.map(escapeCell).join(';')).join('\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.end(`\ufeff${body}`);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      bytes += chunk.length;

      if (bytes > config.maxBodyBytes) {
        settled = true;
        reject(new Error('Corpo da requisição excede 1 MB.'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

module.exports = { sendJson, sendCsv, parseJsonBody };
