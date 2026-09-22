const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-student-flow-'));
const dbFile = path.join(temp, 'db.json');
process.env.SS_DB_PATH = dbFile;
process.env.NODE_ENV = 'test';
process.env.SS_TIME_ZONE = 'America/Sao_Paulo';
const seed = fs.readFileSync(path.join(__dirname, '../data/db.seed.json'));
fs.writeFileSync(dbFile, seed);
const { server, sessions, loginAttempts } = require('../server');
let base;
test.before(async () => { await new Promise(ok=>server.listen(0,'127.0.0.1',ok));base=`http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(ok=>server.close(ok));fs.rmSync(temp,{recursive:true,force:true}); });
test.beforeEach(() => {fs.writeFileSync(dbFile,seed);sessions.clear();loginAttempts.clear();});
async function request(route, method='GET', token=null, body=null) {
 const res = await fetch(base+route,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,body:await res.json().catch(()=>null)};
}
async function login(email='gestor@demo.com',password='demo123') {let r=await request('/api/login','POST',null,{email,password});assert.equal(r.status,200);return r.body.token;}
const student = (n,guardian)=>({name:`Estudante ${n}`,enrollment:`MATR-${n}`,classId:'c1',guardian});
const responsible = {name:'Pessoa Responsável Teste',email:' familia.teste@demo.com ',phone:'(22) 99999-5555',relationship:'Responsável legal'};

test('cadastro exige responsável e não grava matrícula órfã após rejeição',async()=>{
 const mgr=await login();const bad=await request('/api/students','POST',mgr,{name:'Aluno sem responsável',enrollment:'SEM-RESP',classId:'c1'});
 assert.equal(bad.status,400);
 const db=JSON.parse(fs.readFileSync(dbFile));assert.equal(db.students.some(s=>s.enrollment==='SEM-RESP'),false);
});

test('fluxo ponta a ponta: gestão cadastra aluno + responsável, ativa conta e filhos aparecem automaticamente',async()=>{
 const mgr=await login();const gate=await login('portaria@demo.com');
 const created=await request('/api/students','POST',mgr,student('NOVA',responsible));
 assert.equal(created.status,201);assert.equal(created.body.guardianLinked,false);assert.equal(created.body.student.guardians[0].status,'CONVITE_PENDENTE');
 const {activationCode,invitation}=created.body.invitation;
 assert.equal(invitation.email,'familia.teste@demo.com');assert.ok(activationCode.length>=20);
 const stored=JSON.parse(fs.readFileSync(dbFile));assert.equal(stored.guardianInvitations.find(i=>i.email==='familia.teste@demo.com').activationCode,undefined);assert.equal(stored.guardianInvitations.find(i=>i.email==='familia.teste@demo.com').codeHash.length,64);
 assert.equal((await request('/api/guardians','GET',gate)).status,403);
 const invalid=await request('/api/guardian/register','POST',null,{email:responsible.email,code:'CODIGO-INVALIDO',password:'Password123',confirmPassword:'Password123'});
 assert.equal(invalid.status,400);
 const activated=await request('/api/guardian/register','POST',null,{email:responsible.email,code:activationCode,password:'Password123',confirmPassword:'Password123'});
 assert.equal(activated.status,201);assert.equal(activated.body.user.role,'RESPONSAVEL');assert.equal(activated.body.childrenLinked,1);
 const guardian=activated.body.token;
 const children=await request('/api/students','GET',guardian);assert.equal(children.body.students.length,1);assert.equal(children.body.students[0].enrollment,'MATR-NOVA');assert.equal(children.body.students[0].token,undefined);
 const duplicate=await request('/api/guardian/register','POST',null,{email:responsible.email,code:activationCode,password:'Password123',confirmPassword:'Password123'});
 assert.equal(duplicate.status,400);
 const entry=await request('/api/attendance','POST',gate,{token:created.body.student.token,type:'ENTRADA'});
 assert.equal(entry.status,201);assert.equal(entry.body.notified,1);
 const alert=await request('/api/dashboard','GET',guardian);assert.equal(alert.body.metrics.entradasHoje,1);assert.equal(alert.body.notifications[0].studentId,created.body.student.id);
 assert.equal((await request('/api/attendance','POST',guardian,{token:created.body.student.token,type:'SAIDA'})).status,403);
});

test('dois filhos cadastrados com o mesmo convite e terceiro vinculado após ativação; sessão aberta atualiza',async()=>{
 const mgr=await login();
 const a=await request('/api/students','POST',mgr,student('A',responsible));assert.equal(a.status,201);
 const b=await request('/api/students','POST',mgr,student('B',responsible));assert.equal(b.status,201);
 assert.equal((await request('/api/guardian/register','POST',null,{email:responsible.email,code:a.body.invitation.activationCode,password:'Password123',confirmPassword:'Password123'})).status,400);
 const r=await request('/api/guardian/register','POST',null,{email:responsible.email,code:b.body.invitation.activationCode,password:'Password123',confirmPassword:'Password123'});
 assert.equal(r.status,201);assert.equal(r.body.childrenLinked,2);
 const oldSession=r.body.token;const c=await request('/api/students','POST',mgr,student('C',responsible));assert.equal(c.status,201);assert.equal(c.body.guardianLinked,true);
 const list=await request('/api/students','GET',oldSession);assert.deepEqual(list.body.students.map(s=>s.enrollment).sort(),['MATR-A','MATR-B','MATR-C']);
 assert.equal((await request('/api/students','POST',mgr,student('C',responsible))).status,409);
});

test('gestão pode editar e revogar vínculo; portaria não pode editar ou ver convites',async()=>{
 const mgr=await login();const port=await login('portaria@demo.com');const resp=await login('responsavel@demo.com');
 assert.equal((await request('/api/students/s1','PATCH',port,{name:'Novo Nome',enrollment:'2026-001',classId:'c1',status:'ATIVO'})).status,403);
 const edited=await request('/api/students/s1','PATCH',mgr,{name:'Aluno Atualizado',enrollment:'2026-001',classId:'c1',status:'ATIVO'});
 assert.equal(edited.status,200);
 assert.equal((await request('/api/links','DELETE',port,{studentId:'s1',guardianId:'u_resp_1'})).status,403);
 assert.equal((await request('/api/links','DELETE',mgr,{studentId:'s1',guardianId:'u_resp_1'})).status,200);
 const scoped=await request('/api/students','GET',resp);assert.equal(scoped.body.students.some(s=>s.id==='s1'),false);
 const op=await request('/api/students','GET',port);assert.equal(op.body.students.find(s=>s.id==='s1').guardians.length,0);
 assert.equal((await request('/api/links','DELETE',mgr,{studentId:'s1',guardianId:'u_resp_1'})).status,404);
});

test('renovação de convite invalida código anterior e impede leitura pública do código',async()=>{
 const mgr=await login();const created=await request('/api/students','POST',mgr,student('INV',responsible));
 const id=created.body.invitation.invitation.id;
 const renewed=await request(`/api/guardians/invitations/${id}/renew`,'POST',mgr);
 assert.equal(renewed.status,200);
 const list=await request('/api/guardians','GET',mgr);assert.equal(list.status,200);
 assert.equal(JSON.stringify(list.body).includes(renewed.body.activationCode),false);
 const payload=(code)=>({email:responsible.email,code,password:'Password123',confirmPassword:'Password123'});
 assert.equal((await request('/api/guardian/register','POST',null,payload(created.body.invitation.activationCode))).status,400);
 assert.equal((await request('/api/guardian/register','POST',null,payload(renewed.body.activationCode))).status,201);
});

test('edita matrícula, desativa e reativa aluno sem perder acesso da gestão ao registro',async()=>{
 const mgr=await login();const resp=await login('responsavel@demo.com');const gate=await login('portaria@demo.com');
 const inactive=await request('/api/students/s1','PATCH',mgr,{name:'Aluno Arquivado',enrollment:'MATR-ARQUIVO',classId:'c1',status:'INATIVO'});
 assert.equal(inactive.status,200);
 assert.equal((await request('/api/students','GET',resp)).body.students.some(s=>s.id==='s1'),false);
 assert.equal((await request('/api/students','GET',mgr)).body.students.some(s=>s.id==='s1'&&s.status==='INATIVO'),true);
 assert.equal((await request('/api/attendance','POST',gate,{token:'SS-ALU001',type:'ENTRADA'})).status,404);
 assert.equal((await request('/api/students/s1','PATCH',mgr,{name:'Aluno Reativado',enrollment:'MATR-ARQUIVO',classId:'c1',status:'ATIVO'})).status,200);
 assert.equal((await request('/api/students','GET',resp)).body.students.some(s=>s.id==='s1'),true);
});

test('relatório com filtro de data, turma e CSV mantém o escopo do responsável',async()=>{
 const mgr=await login();const gate=await login('portaria@demo.com');const guardian=await login('responsavel@demo.com');
 const created=await request('/api/students','POST',mgr,{name:'Aluno de outra turma',enrollment:'MATR-FILTER',classId:'c3',guardianId:'u_resp_2'});
 assert.equal(created.status,201);
 const record=await request('/api/attendance','POST',gate,{token:'SS-ALU001',type:'ENTRADA'});assert.equal(record.status,201);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const expectedDate=(()=>{let m={};new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(p=>m[p.type]=p.value);return `${m.year}-${m.month}-${m.day}`})();
 const rows=await request(`/api/reports?from=${expectedDate}&to=${expectedDate}&classId=c1`,'GET',guardian);
 assert.equal(rows.status,200);assert.equal(rows.body.rows.some(r=>r.studentId==='s1'&&r.entradas===1),true);
 assert.equal(rows.body.rows.some(r=>r.studentId===created.body.student.id),false);
 assert.equal((await request('/api/reports?from=2026-02-31','GET',guardian)).status,400);
 assert.equal((await request('/api/reports?from=2026-12-31&to=2026-01-01','GET',guardian)).status,400);
 const csv=await fetch(base+`/api/reports.csv?from=${expectedDate}&to=${expectedDate}&classId=c1`,{headers:{Authorization:`Bearer ${guardian}`}});
 const body=await csv.text();assert.equal(csv.status,200);assert.match(body,/Lucas Costa/);assert.doesNotMatch(body,/Aluno de outra turma/);
});

test('não vincula aluno a id de responsável inexistente nem permite cadastro malformado',async()=>{
 const mgr=await login();const old=JSON.parse(fs.readFileSync(dbFile)).students.length;
 assert.equal((await request('/api/students','POST',mgr,{name:'Aluno Inválido',enrollment:'MATR-NEW',classId:'c1',guardianId:'INVALIDO'})).status,404);
 assert.equal((await request('/api/students','POST',mgr,student('BAD',{...responsible,email:'outra conta invalida'}))).status,400);
 assert.equal(JSON.parse(fs.readFileSync(dbFile)).students.length,old);
});

test('gestão emite segundo convite para aluno existente e pode revogá-lo sem excluir aluno',async()=>{
 const mgr=await login();const guardian=await login('responsavel@demo.com');const gate=await login('portaria@demo.com');
 const issued=await request('/api/guardians/invitations','POST',mgr,{studentId:'s1',guardian:responsible});
 assert.equal(issued.status,201);assert.equal(issued.body.invitation.studentIds.includes('s1'),true);
 assert.equal((await request('/api/guardians/invitations','POST',gate,{studentId:'s1',guardian:responsible})).status,403);
 assert.equal((await request('/api/guardians/invitations','DELETE',guardian)).status,404);
 assert.equal((await request(`/api/guardians/invitations/${issued.body.invitation.id}`,'DELETE',mgr)).status,200);
 assert.equal((await request('/api/guardian/register','POST',null,{email:responsible.email,code:issued.body.activationCode,password:'Password123',confirmPassword:'Password123'})).status,400);
 assert.equal((await request('/api/students','GET',guardian)).body.students.some(s=>s.id==='s1'),true);
 assert.equal((await request(`/api/guardians/invitations/${issued.body.invitation.id}`,'DELETE',mgr)).status,404);
});
