/**
 * Testes de integração do Safe Student.
 *
 * Os cenários estão escritos em PT-BR para manter a entrega acadêmica coerente
 * com a documentação e facilitar a apresentação do projeto.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'safe-student-v3-'));
const dbFile=path.join(temp,'safe_student_test.db');
process.env.SS_DB_PATH=dbFile;
process.env.NODE_ENV='test';
process.env.SS_TIME_ZONE='America/Sao_Paulo';
const { initializeDatabaseFromObject, readDatabase } = require('../../src/database/repository');
const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/db.seed.json'),'utf8'));
initializeDatabaseFromObject(seed);
const {
  server,sessions,loginAttempts
}
=require('../../server');
let base;
test.before(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));base=`http://127.0.0.1:${server.address().port}`
});
test.after(async()=>{
  await new Promise(ok=>server.close(ok));fs.rmSync(temp,{
    recursive:true,force:true
  })
});
test.beforeEach(()=>{
  initializeDatabaseFromObject(seed);sessions.clear();loginAttempts.clear()
});
async function req(route,method='GET',token=null,body=null,headers={
}){
  const r=await fetch(base+route,{
    method,headers:{
      ...headers,...(token?{
        Authorization:`Bearer ${token}`
      }
      :{
      }),...(body?{
        'Content-Type':'application/json'
      }
      :{
      })
    },...(body?{
      body:JSON.stringify(body)
    }
    :{
    })
  });
  return {
    status:r.status,body:await r.json().catch(()=>null),headers:r.headers
  }
}
async function login(email='gestor@demo.com'){
  const r=await req('/api/login','POST',null,{
    email,password:'demo123'
  });
  assert.equal(r.status,200);
  return r.body.token
}
test('matrícula integrada aceita vários responsáveis em uma única operação',async()=>{
  const manager=await login(); const r=await req('/api/students','POST',manager,{
    name:'Aluno Multi Família',enrollment:'MULTI-001',classId:'c1',guardians:[ {
      guardianId:'u_resp_1'
    }, {
      guardian:{
        name:'Novo Responsável Multi',email:'multi.guardian@demo.com',phone:'(22) 99999-2020',relationship:'Responsável legal'
      }
    } ]
  }); assert.equal(r.status,201);assert.equal(r.body.linkedGuardians.length,1);assert.equal(r.body.invitations.length,1);assert.equal(r.body.student.guardians.length,2); const db=readDatabase();const student=db.students.find(s=>s.enrollment==='MULTI-001');assert.ok(student);assert.equal(db.users.find(u=>u.id==='u_resp_1').studentIds.includes(student.id),true);assert.equal(db.guardianInvitations.some(i=>i.email==='multi.guardian@demo.com'&&i.studentIds.includes(student.id)),true);
});
test('matrícula com múltiplos responsáveis é atômica quando um item é inválido',async()=>{
  const manager=await login();const before=readDatabase().students.length; const r=await req('/api/students','POST',manager,{
    name:'Não deve persistir',enrollment:'MULTI-BAD',classId:'c1',guardians:[{
      guardianId:'u_resp_1'
    },{
      guardian:{
        name:'X',email:'invalido',phone:'1',relationship:'Mãe'
      }
    }]
  }); assert.equal(r.status,400);assert.equal(readDatabase().students.length,before);
});
test('consulta operacional da portaria decide a próxima ação válida',async()=>{
  const gate=await login('portaria@demo.com'); let look=await req('/api/attendance/lookup?token=SS-ALU001','GET',gate);assert.equal(look.status,200);assert.equal(look.body.nextAction,'ENTRADA'); let move=await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:look.body.nextAction,method:'QR_CAMERA'
  });assert.equal(move.status,201);assert.equal(move.body.record.method,'QR_CAMERA'); look=await req('/api/attendance/lookup?token=SS-ALU001','GET',gate);assert.equal(look.body.operational.state,'DENTRO');assert.equal(look.body.nextAction,'SAIDA'); await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:'SAIDA'
  });look=await req('/api/attendance/lookup?token=SS-ALU001','GET',gate);assert.equal(look.body.operational.state,'FORA');assert.equal(look.body.nextAction,'ENTRADA');
});
test('relatório aplica aluno e tipo e CSV usa os mesmos filtros',async()=>{
  const gate=await login('portaria@demo.com');const guardian=await login('responsavel@demo.com'); await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:'ENTRADA'
  });await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:'SAIDA'
  }); const report=await req('/api/reports?studentId=s1&type=ENTRADA','GET',guardian);assert.equal(report.status,200);assert.equal(report.body.events.every(e=>e.studentId==='s1'&&e.type==='ENTRADA'),true);assert.equal(report.body.summary.saidas,0); const csv=await fetch(base+'/api/reports.csv?studentId=s1&type=ENTRADA',{
    headers:{
      Authorization:`Bearer ${guardian}`
    }
  });const text=await csv.text();assert.equal(csv.status,200);assert.match(text,/ENTRADA/);assert.doesNotMatch(text,/"SAIDA"/);
});
test('notificações possuem endpoint filtrável por não lidas e aluno',async()=>{
  const gate=await login('portaria@demo.com');const guardian=await login('responsavel@demo.com');await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:'ENTRADA'
  }); const n=await req('/api/notifications?unread=1&studentId=s1','GET',guardian);assert.equal(n.status,200);assert.ok(n.body.notifications.length>=1);assert.equal(n.body.notifications.every(x=>x.studentId==='s1'&&!x.read),true);
});
test('mensagens são agrupadas em conversas apenas com participantes do usuário',async()=>{
  const guardian=await login('responsavel@demo.com');const data=await req('/api/messages/conversations','GET',guardian);assert.equal(data.status,200);assert.ok(data.body.conversations.length>=1);assert.equal(data.body.conversations.every(c=>c.peer.id!=='u_resp_1'),true);assert.equal(data.body.conversations.every(c=>c.messages.every(m=>typeof m.ownMessage==='boolean')),true);
});
test('auditoria aceita filtros de ação e texto',async()=>{
  const manager=await login();await req('/api/students/s1','PATCH',manager,{
    name:'Lucas Auditado',enrollment:'2026-001',classId:'c1',status:'ATIVO'
  }); const data=await req('/api/audit?action=ATUALIZAR&q=Lucas','GET',manager);assert.equal(data.status,200);assert.ok(data.body.rows.some(x=>x.action==='ATUALIZAR_ALUNO'));assert.equal(data.body.rows.every(x=>x.action.includes('ATUALIZAR')),true);assert.ok(data.body.filters.actions.includes('ATUALIZAR_ALUNO'));
});
test('login cria cookie HttpOnly e API aceita sessão pelo cookie',async()=>{
  const loginResponse=await req('/api/login','POST',null,{
    email:'responsavel@demo.com',password:'demo123'
  });const cookie=loginResponse.headers.get('set-cookie');assert.match(cookie,/ss_session=/);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i); const me=await req('/api/me','GET',null,null,{
    Cookie:cookie.split(';')[0]
  });assert.equal(me.status,200);assert.equal(me.body.user.role,'RESPONSAVEL');
});
test('frontend expõe módulos operacionais novos sem bibliotecas externas',async()=>{
  const html=await (await fetch(base+'/')).text();const js=[await (await fetch(base+'/js/views/presence.js')).text(),await (await fetch(base+'/js/views/students.js')).text(),await (await fetch(base+'/js/views/studentProfile.js')).text(),await (await fetch(base+'/js/core/events.js')).text()].join('\n');const css=await (await fetch(base+'/css/evolution.css')).text(); assert.match(html,/Matrícula integrada/);assert.match(html,/Le(r|itura).*QR|Ler QR/);assert.match(html,/Central de responsáveis/);assert.match(html,/Relatório operacional/);assert.match(html,/Trilha de auditoria/);assert.match(js,/BarcodeDetector/);assert.match(css,/messenger-shell/);
});
test('perfil completo do aluno organiza movimentações e trilha administrativa para gestão',async()=>{
  const manager=await login();const gate=await login('portaria@demo.com'); await req('/api/attendance','POST',gate,{
    token:'SS-ALU001',type:'ENTRADA',method:'QR_CAMERA'
  }); await req('/api/students/s1','PATCH',manager,{
    name:'Lucas Costa',enrollment:'2026-001',classId:'c1',status:'ATIVO'
  }); const profile=await req('/api/students/s1/profile','GET',manager); assert.equal(profile.status,200);assert.equal(profile.body.student.id,'s1');assert.ok(profile.body.guardians.some(g=>g.name==='Mariana Costa')); assert.ok(profile.body.movements.some(m=>m.type==='ENTRADA'&&m.registeredByName==='Rafael Souza')); assert.ok(profile.body.administrative.some(a=>a.action==='ATUALIZAR_ALUNO')); assert.ok(profile.body.timeline.some(e=>e.category==='MOVIMENTACAO'));assert.ok(profile.body.timeline.some(e=>e.category==='ADMINISTRATIVO'));
});
test('perfil do aluno preserva privacidade da portaria',async()=>{
  const gate=await login('portaria@demo.com');const profile=await req('/api/students/s1/profile','GET',gate); assert.equal(profile.status,200);assert.deepEqual(profile.body.guardians,[]);assert.deepEqual(profile.body.notifications,[]);assert.deepEqual(profile.body.administrative,[]); assert.equal(profile.body.permissions.canSeeFamilyContacts,false);assert.equal(profile.body.permissions.canSeeAdministrativeHistory,false); assert.ok(profile.body.student.token);
});
test('responsável abre histórico somente dos próprios filhos e vê notificações do filho',async()=>{
  const guardian=await login('responsavel@demo.com'); const own=await req('/api/students/s1/profile','GET',guardian);assert.equal(own.status,200);assert.equal(own.body.student.id,'s1');assert.equal(own.body.student.token,undefined); assert.ok(own.body.notifications.every(n=>n.studentId==='s1'));assert.equal(own.body.permissions.canSeeOwnNotifications,true); const other=await req('/api/students/s3/profile','GET',guardian);assert.equal(other.status,404);
});
test('frontend permite abrir histórico individual pelo nome do aluno',async()=>{
  const html=await (await fetch(base+'/')).text();const js=[await (await fetch(base+'/js/views/presence.js')).text(),await (await fetch(base+'/js/views/students.js')).text(),await (await fetch(base+'/js/views/studentProfile.js')).text(),await (await fetch(base+'/js/core/events.js')).text()].join('\n');const css=await (await fetch(base+'/css/evolution.css')).text(); assert.match(html,/view-student-profile/);assert.match(html,/Linha do tempo do aluno/);assert.match(js,/data-student-profile/);assert.match(js,/openStudentProfile/);assert.match(css,/student-history-timeline/);
});

test('painel refinado carrega tema consistente e tokens próprios para ações', async () => {
  const html = await (await fetch(base + '/')).text();
  const css = await (await fetch(base + '/css/interface-polish.css')).text();

  assert.match(html, /css\/interface-polish\.css/);
  assert.match(html, /dashboard-priority-grid/);
  assert.match(html, /dashboard-side-stack/);
  assert.match(css, /--action-bg:/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /\.btn\.primary/);
  assert.match(css, /\.bubble\.mine/);
});
