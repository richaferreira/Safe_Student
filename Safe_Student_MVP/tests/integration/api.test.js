/**
 * Testes de integração do Safe Student.
 *
 * Os cenários estão escritos em PT-BR para manter a entrega acadêmica coerente
 * com a documentação e facilitar a apresentação do projeto.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  hashPassword
}
= require('../../src/services/security');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-test-'));
const dbPath = path.join(tempDir, 'safe_student_test.db');
process.env.SS_DB_PATH = dbPath;
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
process.env.NODE_ENV = 'test';
const { initializeDatabaseFromObject, readDatabase, writeDatabase } = require('../../src/database/repository');
function seed() {
  return {
    school: {
      id: 'school_demo', name: 'Escola Teste', city: 'Saquarema - RJ', mode: 'DADOS DE DEMONSTRAÇÃO'
    }, users: [ {
      id: 'resp1', name: 'Responsável 1', email: 'responsavel@demo.com', cpf: '12345678909', passwordHash: hashPassword('demo123', 'resp-test-salt01'), role: 'RESPONSAVEL', studentIds: ['s1'], status: 'ATIVO'
    }, {
      id: 'resp2', name: 'Responsável 2', email: 'outro@demo.com', passwordHash: hashPassword('demo123', 'resp-test-salt02'), role: 'RESPONSAVEL', studentIds: ['s2'], status: 'ATIVO'
    }, {
      id: 'port1', name: 'Portaria', email: 'portaria@demo.com', passwordHash: hashPassword('demo123', 'port-test-salt01'), role: 'PORTARIA', studentIds: [], status: 'ATIVO'
    }, {
      id: 'gest1', name: 'Gestão', email: 'gestor@demo.com', passwordHash: hashPassword('demo123', 'gest-test-salt01'), role: 'GESTAO', studentIds: [], status: 'ATIVO'
    }, ], classes: [{
      id: 'c1', name: '6º Ano A', shift: 'Manhã'
    }], students: [ {
      id: 's1', name: 'Aluno Um', enrollment: '2026-001', classId: 'c1', token: 'SS-ALU001', status: 'ATIVO'
    }, {
      id: 's2', name: 'Aluno Dois', enrollment: '2026-002', classId: 'c1', token: 'SS-ALU002', status: 'ATIVO'
    }, ], attendance: [], notifications: [], messages: [], audit: [], feedback: [{
      id: 'demo', userId: 'resp1', profile: 'Responsável', score: 5, comment: 'Ilustrativo', createdAt: '2026-06-18T14:20:00.000Z'
    }],
  };
}
function resetDb() {
  initializeDatabaseFromObject(seed());
}
resetDb();
const {
  server, sessions, loginAttempts, passwordResets
}
= require('../../server');
let base;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve)); fs.rmSync(tempDir, {
    recursive: true, force: true
  });
});
test.beforeEach(() => {
  resetDb(); sessions.clear(); loginAttempts.clear(); passwordResets.clear();
});
async function request(url, options = {
}) {
  const res = await fetch(`${base}${url}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return {
    res, body
  };
}
async function login(email) {
  const {
    res, body
  }
  = await request('/api/login', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email, password: 'demo123'
    }),
  });
  assert.equal(res.status, 200);
  return body.token;
}
const auth = (token) => ({
  Authorization: `Bearer ${token}`
});
test('health funciona sem autenticação', async () => {
  const {
    res, body
  }
  = await request('/api/health'); assert.equal(res.status, 200); assert.equal(body.ok, true); assert.equal(body.timeZone, 'America/Sao_Paulo');
});
test('login inválido retorna 401', async () => {
  const {
    res
  }
  = await request('/api/login', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'responsavel@demo.com', password: 'errada'
    })
  }); assert.equal(res.status, 401);
});
test('recuperação de senha gera código temporário, redefine senha e invalida o código', async () => {
  const requested = await request('/api/password/forgot', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'gestor@demo.com'
    }),
  }); assert.equal(requested.res.status, 200); assert.match(requested.body.demoCode, /^\d{6}$/); const changed = await request('/api/password/reset', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'gestor@demo.com', code: requested.body.demoCode, password: 'NovaSenha123', confirmPassword: 'NovaSenha123'
    }),
  }); assert.equal(changed.res.status, 200); const logged = await request('/api/login', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'gestor@demo.com', password: 'NovaSenha123'
    }),
  }); assert.equal(logged.res.status, 200); const reused = await request('/api/password/reset', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'gestor@demo.com', code: requested.body.demoCode, password: 'OutraSenha123', confirmPassword: 'OutraSenha123'
    }),
  }); assert.equal(reused.res.status, 400);
});
test('responsável não pode registrar presença', async () => {
  const token = await login('responsavel@demo.com'); const {
    res
  }
  = await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      token: 'SS-ALU001', type: 'ENTRADA'
    })
  }); assert.equal(res.status, 403);
});
test('portaria registra entrada e bloqueia segunda entrada', async () => {
  const token = await login('portaria@demo.com'); const first = await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      token: 'SS-ALU001', type: 'ENTRADA'
    })
  }); assert.equal(first.res.status, 201); assert.equal(first.body.notified, 1); const second = await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      token: 'SS-ALU001', type: 'ENTRADA'
    })
  }); assert.equal(second.res.status, 409);
});
test('responsável não envia mensagem a outro responsável manipulando a API', async () => {
  const token = await login('responsavel@demo.com'); const directory = await request('/api/directory', {
    headers: auth(token)
  }); assert.equal(directory.body.people.some((p) => p.id === 'resp2'), false); const send = await request('/api/messages', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      toUserId: 'resp2', text: 'Tentativa indevida'
    })
  }); assert.equal(send.res.status, 403);
});
test('CSV exige autenticação', async () => {
  const noAuth = await request('/api/reports.csv'); assert.equal(noAuth.res.status, 401); const token = await login('responsavel@demo.com'); const yes = await request('/api/reports.csv', {
    headers: auth(token)
  }); assert.equal(yes.res.status, 200); assert.match(yes.res.headers.get('content-type'), /text\/csv/);
});
test('feedback separa dados ilustrativos de evidência coletada', async () => {
  const token = await login('responsavel@demo.com'); const post = await request('/api/feedback', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      profile: 'Responsável', scenario: 'Consultar entrada do aluno', success: true, timeSeconds: 18, score: 5, comment: 'Fluxo claro.'
    })
  }); assert.equal(post.res.status, 201); const get = await request('/api/feedback', {
    headers: auth(token)
  }); assert.equal(get.body.total, 1); assert.equal(get.body.demoSeedCount, 1); assert.equal(get.body.successRate, 100); assert.equal(get.body.avgTimeSeconds, 18);
});
test('somente gestão exporta CSV de validação', async () => {
  const resp = await login('responsavel@demo.com'); assert.equal((await request('/api/feedback.csv', {
    headers: auth(resp)
  })).res.status, 403); const gest = await login('gestor@demo.com'); const allowed = await request('/api/feedback.csv', {
    headers: auth(gest)
  }); assert.equal(allowed.res.status, 200); assert.match(allowed.body, /Cenário/);
});
test('painel do responsável limita estudantes e não expõe tokens', async () => {
  const token = await login('responsavel@demo.com'); const {
    res, body
  }
  = await request('/api/dashboard', {
    headers: auth(token)
  }); assert.equal(res.status, 200); assert.deepEqual(body.students.map((s) => s.id), ['s1']); assert.deepEqual(body.studentStatuses.map((s) => s.id), ['s1']); assert.equal(body.students[0].token, undefined); assert.equal(body.studentStatuses[0].lastType, null);
});
test('painel apresenta apenas última movimentação do dia e escopo correto', async () => {
  const portaria = await login('portaria@demo.com'); const record = async (type) => request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(portaria)
    }, body: JSON.stringify({
      token: 'SS-ALU001', type
    }),
  }); assert.equal((await record('ENTRADA')).res.status, 201); let dashboard = await request('/api/dashboard', {
    headers: auth(portaria)
  }); assert.equal(dashboard.body.metrics.semSaidaHoje, 1); assert.equal(dashboard.body.studentStatuses.find((s) => s.id === 's1').lastType, 'ENTRADA'); assert.equal((await record('SAIDA')).res.status, 201); dashboard = await request('/api/dashboard', {
    headers: auth(portaria)
  }); assert.equal(dashboard.body.metrics.semSaidaHoje, 0); assert.equal(dashboard.body.studentStatuses.find((s) => s.id === 's1').lastType, 'SAIDA'); const guardian = await login('responsavel@demo.com'); const scoped = await request('/api/dashboard', {
    headers: auth(guardian)
  }); assert.equal(scoped.body.studentStatuses.length, 1); assert.equal(scoped.body.studentStatuses[0].lastType, 'SAIDA');
});
test('exportação CSV neutraliza fórmula inserida em nome do estudante', async () => {
  const manager = await login('gestor@demo.com'); const added = await request('/api/students', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      name: '=1+2', enrollment: 'TEST-FORMULA', classId: 'c1', guardianId: 'resp1'
    }),
  }); assert.equal(added.res.status, 201); const event = await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      token: added.body.student.token, type: 'ENTRADA'
    }),
  }); assert.equal(event.res.status, 201); const exported = await request('/api/reports.csv', {
    headers: auth(manager)
  }); assert.equal(exported.res.status, 200); assert.match(exported.body, /"'=1\+2"/); assert.doesNotMatch(exported.body, /(?:^|\n)"=1\+2"/);
});
test('frontend profissional e seus assets são servidos pelo HTTP', async () => {
  const page = await request('/'); const stylesheet = await request('/css/professional.css'); assert.equal(page.res.status, 200); assert.match(page.body, /Portal de presença escolar/); assert.match(page.body, /id="studentPulse"/); assert.doesNotMatch(page.body, /MVP V1\.1/); assert.equal(stylesheet.res.status, 200); assert.match(stylesheet.res.headers.get('content-type'), /text\/css/);
});
test('cadastro de aluno exige gestão e matrícula única', async () => {
  const guardian = await login('responsavel@demo.com'); const manager = await login('gestor@demo.com'); const payload = JSON.stringify({
    name: 'Estudante Novo', enrollment: '2026-NEW', classId: 'c1', guardianId: 'resp1'
  }); const options = (token) => ({
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: payload
  }); assert.equal((await request('/api/students', options(guardian))).res.status, 403); const created = await request('/api/students', options(manager)); assert.equal(created.res.status, 201); assert.equal(created.body.student.name, 'Estudante Novo'); assert.equal((await request('/api/students', options(manager))).res.status, 409);
});
test('CPF do responsável já ativo vincula o novo aluno automaticamente, sem convite', async () => {
  const manager = await login('gestor@demo.com'); const {
    res, body
  }
  = await request('/api/students', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      name: 'Irmão Novo', enrollment: '2026-CPF1', classId: 'c1', guardian: {
        name: 'Responsável 1', email: 'outro-email-do-mesmo-responsavel@demo.com', phone: '22999990000', relationship: 'Mãe', cpf: '123.456.789-09'
      }
    }),
  }); assert.equal(res.status, 201); assert.equal(body.guardianLinked, true); assert.equal(body.invitation, null); const guardian = await login('responsavel@demo.com'); const mine = await request('/api/students', {
    headers: auth(guardian)
  }); assert.deepEqual(mine.body.students.map((s) => s.enrollment).sort(), ['2026-001', '2026-CPF1']);
});
test('CPF inválido é rejeitado no cadastro de aluno', async () => {
  const manager = await login('gestor@demo.com'); const {
    res, body
  }
  = await request('/api/students', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      name: 'Estudante X', enrollment: '2026-CPFX', classId: 'c1', guardian: {
        name: 'Responsável Novo', email: 'novo.resp@demo.com', phone: '22988887777', relationship: 'Pai', cpf: '111.111.111-11'
      }
    }),
  }); assert.equal(res.status, 400); assert.match(body.error, /CPF/);
});
test('CPF de responsável ativo com nome divergente é bloqueado por segurança', async () => {
  const manager = await login('gestor@demo.com'); const {
    res, body
  }
  = await request('/api/students', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      name: 'Estudante Y', enrollment: '2026-CPFY', classId: 'c1', guardian: {
        name: 'Nome Diferente', email: 'outro2@demo.com', phone: '22988887777', relationship: 'Pai', cpf: '123.456.789-09'
      }
    }),
  }); assert.equal(res.status, 409); assert.match(body.error, /nome/);
});
test('convite carrega CPF mascarado e ativação rejeita CPF inválido ou duplicado', async () => {
  const manager = await login('gestor@demo.com'); const created = await request('/api/students', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(manager)
    }, body: JSON.stringify({
      name: 'Estudante Z', enrollment: '2026-CPFZ', classId: 'c1', guardian: {
        name: 'Família Nova', email: 'familia.nova@demo.com', phone: '22977776666', relationship: 'Mãe', cpf: '987.654.321-00'
      }
    }),
  }); assert.equal(created.res.status, 201); assert.equal(created.body.invitation.invitation.cpfMasked, '***.***.321-00'); const code = created.body.invitation.activationCode; const badCpf = await request('/api/guardian/register', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'familia.nova@demo.com', code, password: 'senhaForte123', confirmPassword: 'senhaForte123', cpf: '111.111.111-11'
    }),
  }); assert.equal(badCpf.res.status, 400); const dupeCpf = await request('/api/guardian/register', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'familia.nova@demo.com', code, password: 'senhaForte123', confirmPassword: 'senhaForte123', cpf: '123.456.789-09'
    }),
  }); assert.equal(dupeCpf.res.status, 409); const ok = await request('/api/guardian/register', {
    method: 'POST', headers: {
      'Content-Type': 'application/json'
    }, body: JSON.stringify({
      email: 'familia.nova@demo.com', code, password: 'senhaForte123', confirmPassword: 'senhaForte123'
    }),
  }); assert.equal(ok.res.status, 201); assert.equal(ok.body.childrenLinked, 1);
});
test('vínculo é restrito à gestão e altera o escopo do responsável', async () => {
  const guardian = await login('responsavel@demo.com'); const manager = await login('gestor@demo.com'); const options = (token) => ({
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(token)
    }, body: JSON.stringify({
      guardianId: 'resp1', studentId: 's2'
    }),
  }); assert.equal((await request('/api/links', options(guardian))).res.status, 403); assert.equal((await request('/api/links', options(manager))).res.status, 200); const updated = await request('/api/students', {
    headers: auth(guardian)
  }); assert.deepEqual(updated.body.students.map((s) => s.id).sort(), ['s1', 's2']); assert.equal(updated.body.students.every((s) => s.token === undefined), true);
});
test('marcação como lida respeita destinatário da notificação', async () => {
  const gate = await login('portaria@demo.com'); const guardian = await login('responsavel@demo.com'); const other = await login('outro@demo.com'); assert.equal((await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(gate)
    }, body: JSON.stringify({
      token: 'SS-ALU001', type: 'ENTRADA'
    }),
  })).res.status, 201); const dashboard = await request('/api/dashboard', {
    headers: auth(guardian)
  }); const notificationId = dashboard.body.notifications[0].id; assert.equal((await request(`/api/notifications/${notificationId}`, {
    method: 'PATCH', headers: auth(other)
  })).res.status, 404); const own = await request(`/api/notifications/${notificationId}`, {
    method: 'PATCH', headers: auth(guardian)
  }); assert.equal(own.res.status, 200); assert.equal(own.body.notification.read, true);
});
test('relatórios e CSV respeitam o escopo e auditoria exige gestão', async () => {
  const gate = await login('portaria@demo.com'); const guardian = await login('responsavel@demo.com'); const manager = await login('gestor@demo.com'); const reportGate = await request('/api/reports', {
    headers: auth(gate)
  }); const reportGuardian = await request('/api/reports', {
    headers: auth(guardian)
  }); assert.deepEqual(reportGate.body.rows.map((r) => r.studentId).sort(), ['s1', 's2']); assert.deepEqual(reportGuardian.body.rows.map((r) => r.studentId), ['s1']); assert.equal((await request('/api/audit', {
    headers: auth(gate)
  })).res.status, 403); assert.equal((await request('/api/audit', {
    headers: auth(guardian)
  })).res.status, 403); assert.equal((await request('/api/audit', {
    headers: auth(manager)
  })).res.status, 200); await request('/api/attendance', {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...auth(gate)
    }, body: JSON.stringify({
      token: 'SS-ALU002', type: 'ENTRADA'
    }),
  }); const scopedCsv = await request('/api/reports.csv', {
    headers: auth(guardian)
  }); assert.doesNotMatch(scopedCsv.body, /Aluno Dois/); assert.doesNotMatch(scopedCsv.body, /2026-002/);
});
test('painel institucional serve interface, estilo e ilustração com MIME correto', async () => {
  const page = await request('/'); const styles = await request('/css/school-experience.css'); const artwork = await request('/assets/school-campus.jpg'); assert.equal(page.res.status, 200); assert.match(page.body, /Acesse o seu portal/); assert.match(page.body, /id="activityChart"/); assert.match(page.body, /id="mobileNavBtn"/); assert.equal(styles.res.status, 200); assert.match(styles.res.headers.get('content-type'), /text\/css/); assert.equal(artwork.res.status, 200); assert.match(artwork.res.headers.get('content-type'), /image\/jpeg/);
});
test('indicadores semanais e de turma refletem somente alunos do perfil e registros reais', async () => {
  const manager = await login('gestor@demo.com'); const guardian = await login('responsavel@demo.com'); const date = new Date().toISOString(); const db = readDatabase(); db.attendance.push({
    id: 'live-1', studentId: 's1', type: 'ENTRADA', timestamp: date, method: 'QR_TOKEN'
  }); db.attendance.push({
    id: 'live-2', studentId: 's2', type: 'ENTRADA', timestamp: date, method: 'QR_TOKEN'
  }); db.messages.push({
    id: 'private-msg', fromUserId: 'resp2', toUserId: 'gest1', text: 'Mensagem privada do outro responsável', createdAt: date
  }); writeDatabase(db); const managerDashboard = await request('/api/dashboard', {
    headers: auth(manager)
  }); const guardianDashboard = await request('/api/dashboard', {
    headers: auth(guardian)
  }); assert.equal(managerDashboard.body.metrics.entradasHoje, 2); assert.equal(guardianDashboard.body.metrics.entradasHoje, 1); assert.equal(managerDashboard.body.weeklyMovements.length, 7); assert.equal(guardianDashboard.body.weeklyMovements.at(-1).entradas, 1); assert.equal(managerDashboard.body.weeklyMovements.at(-1).entradas, 2); assert.equal(guardianDashboard.body.classOverview.length, 1); assert.deepEqual(guardianDashboard.body.classOverview[0], {
    name: '6º Ano A - Manhã', students: 1, entradasSemSaida: 1, saidas: 0, semRegistro: 0,
  }); assert.equal(guardianDashboard.body.recentMessages.some((m) => m.text.includes('Mensagem privada')), false); assert.equal(managerDashboard.body.recentMessages.some((m) => m.text.includes('Mensagem privada')), true); assert.equal(guardianDashboard.body.students[0].token, undefined);
});
test('gráfico semanal sem movimentos não inventa taxas ou presenças', async () => {
  const token = await login('gestor@demo.com'); const {
    body, res
  }
  = await request('/api/dashboard', {
    headers: auth(token)
  }); assert.equal(res.status, 200); assert.equal(body.weeklyMovements.length, 7); assert.equal(body.weeklyMovements.every((d) => d.entradas === 0 && d.saidas === 0), true); assert.equal(body.classOverview.reduce((sum, c) => sum + c.students, 0), body.metrics.students); assert.equal(body.classOverview.every((c) => c.semRegistro === c.students), true);
});
