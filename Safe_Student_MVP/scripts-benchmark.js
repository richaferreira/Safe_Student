const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-benchmark-'));
const tempDb = path.join(tempDir, 'db.json');
fs.copyFileSync(path.join(__dirname, 'data/db.seed.json'), tempDb);
process.env.SS_DB_PATH = tempDb;
process.env.NODE_ENV = 'test';
process.env.SS_TIME_ZONE = process.env.SS_TIME_ZONE || 'America/Sao_Paulo';
const { server } = require('./server');

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] || 0;
}

async function timed(name, fn, samples = 15) {
  const values = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    const response = await fn();
    const elapsed = performance.now() - start;
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await response.arrayBuffer();
    values.push(elapsed);
  }
  return {
    operation: name,
    samples,
    p50Ms: Math.round(percentile(values, 50) * 10) / 10,
    p95Ms: Math.round(percentile(values, 95) * 10) / 10,
    maxMs: Math.round(Math.max(...values) * 10) / 10,
  };
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@demo.com', password: 'demo123' }),
    });
    if (!login.ok) throw new Error(`Login falhou: HTTP ${login.status}`);
    const { token } = await login.json();
    const headers = { Authorization: `Bearer ${token}` };
    const results = [
      await timed('GET /api/dashboard', () => fetch(`${base}/api/dashboard`, { headers })),
      await timed('GET /api/students', () => fetch(`${base}/api/students`, { headers })),
      await timed('GET /api/reports', () => fetch(`${base}/api/reports`, { headers })),
      await timed('GET /api/audit', () => fetch(`${base}/api/audit`, { headers })),
    ];
    const targetMs = 2000;
    const passed = results.every((row) => row.p95Ms <= targetMs);
    console.table(results);
    console.log(`Meta RNF-05 (p95 <= ${targetMs} ms, ambiente local): ${passed ? 'ATENDIDA NESTA EXECUÇÃO' : 'NÃO ATENDIDA NESTA EXECUÇÃO'}`);
    console.log('Observação: este benchmark é local e não substitui teste de carga ou homologação de produção.');
    process.exitCode = passed ? 0 : 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch(async (error) => {
  console.error(error);
  try { await new Promise((resolve) => server.close(resolve)); } catch {}
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = 1;
});
