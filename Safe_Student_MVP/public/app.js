let currentUser=null;
let dashboard=null;
let students=[];
let notifications=[];
let reports=[];
let feedbacks=[];
let classCatalog=[];
let guardianCatalog=[];
let invitationCatalog=[];
let editingStudentId=null;
let latestInvitations=[];
let guardianDrafts=[];
let wizardStep=1;
let schoolTimeZone='America/Sao_Paulo';
let selectedPresence=null;
let presenceMethod='TOKEN_MANUAL';
let qrStream=null;
let qrLoop=null;
let messageDirectory=[];
let allMessages=[];
let selectedMessagePeer=null;

const $=id=>document.getElementById(id);
const qsa=s=>Array.from(document.querySelectorAll(s));
const viewMeta={
  dashboard:['Painel','Visão geral','Movimentações, comunicação e ações dentro do seu escopo.'],
  presence:['Operação','Presença / Portaria','Identifique o aluno e execute somente a próxima movimentação válida.'],
  students:['Cadastros','Alunos e vínculos','Consulte estudantes e, na gestão, mantenha os vínculos familiares.'],
  guardians:['Famílias','Responsáveis e convites','Revise contas, vínculos e convites pendentes.'],
  notifications:['Comunicação','Notificações','Avisos internos gerados pelas movimentações.'],
  reports:['Rastreabilidade','Relatórios','Filtre os eventos e exporte exatamente o mesmo conjunto em CSV.'],
  messages:['Relacionamento','Comunicação','Converse apenas com perfis permitidos pelas regras do sistema.'],
  audit:['Administração','Auditoria','Consulte eventos críticos registrados pelo backend.'],
  feedback:['Demonstração','Validação acadêmica','Registre avaliações de teste sem dados pessoais.'],
  privacy:['Informações','Privacidade','Controles existentes e limites do ambiente acadêmico.']
};

async function api(path,opts={}){
  const headers={...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})};
  const response=await fetch(path,{...opts,credentials:'same-origin',headers});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Falha na operação.');
  return data;
}
async function apiBlob(path){
  const response=await fetch(path,{credentials:'same-origin'});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Falha na exportação.');}
  return {blob:await response.blob(),disposition:response.headers.get('content-disposition')||''};
}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function fmt(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:schoolTimeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'}
function fmtDate(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:schoolTimeZone,dateStyle:'short'}).format(new Date(v)):'-'}
function roleName(r){return {RESPONSAVEL:'Responsável',PORTARIA:'Portaria',GESTAO:'Gestão escolar',ADMIN:'Administrador'}[r]||r}
function initials(name){return String(name||'SS').split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3400)}
function icon(name){return `<svg class="nav-icon" aria-hidden="true"><use href="#${name}"/></svg>`}
function isManager(){return ['GESTAO','ADMIN'].includes(currentUser?.role)}
function isOperator(){return ['PORTARIA','GESTAO','ADMIN'].includes(currentUser?.role)}
function setBusy(button,busy,label){if(!button)return;if(busy){button.dataset.original=button.textContent;button.disabled=true;button.textContent=label||'Aguarde...'}else{button.disabled=false;if(button.dataset.original)button.textContent=button.dataset.original;delete button.dataset.original}}

function showShell(logged){$('loginView').classList.toggle('hidden',logged);$('appView').classList.toggle('hidden',!logged);$('logoutBtn').classList.toggle('hidden',!logged);$('appTopContext').classList.toggle('hidden',!logged);document.body.classList.toggle('is-authenticated',logged);if(!logged)closeMobileNav()}
function applyRole(){
  const manager=isManager(),operator=isOperator();
  qsa('.role-manager').forEach(el=>el.classList.toggle('permission-hidden',!manager));
  qsa('.role-op').forEach(el=>el.classList.toggle('permission-hidden',!operator));
  $('userName').textContent=currentUser?.name||'';$('userRole').textContent=roleName(currentUser?.role);
  $('avatar').textContent=initials(currentUser?.name);$('headerAvatar').textContent=initials(currentUser?.name);
  $('headerName').textContent=currentUser?.name||'';$('headerRole').textContent=roleName(currentUser?.role);
  configureQuickAction();
}
function closeMobileNav(){document.body.classList.remove('mobile-nav-open');$('mobileNavBtn').setAttribute('aria-expanded','false');$('mobileNavBtn').setAttribute('aria-label','Abrir menu')}
async function goView(name){
  if(!viewMeta[name])return;
  if(name==='guardians'&&!isManager())return;
  if(name==='presence'&&!isOperator())return;
  if(name==='audit'&&!isManager())return;
  qsa('.view-section').forEach(v=>v.classList.add('hidden'));$(`view-${name}`).classList.remove('hidden');
  qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const meta=viewMeta[name];$('pageEyebrow').textContent=meta[0];$('pageTitle').textContent=meta[1];$('pageSubtitle').textContent=meta[2];
  try{
    if(name==='students')await loadStudents();
    if(name==='guardians')await loadGuardians();
    if(name==='presence'){await ensureStudents();renderPresenceRecent();}
    if(name==='notifications')await loadNotifications();
    if(name==='reports')await loadReports();
    if(name==='messages')await loadMessages();
    if(name==='audit')await loadAudit();
    if(name==='feedback')await loadFeedback();
  }catch(e){toast(e.message)}
  closeMobileNav();
}

function statusMeta(state){
  if(state==='DENTRO')return {label:'DENTRO*',cls:'state-in',text:'Último registro de hoje foi ENTRADA.'};
  if(state==='FORA')return {label:'FORA*',cls:'state-out',text:'Último registro de hoje foi SAÍDA.'};
  return {label:'SEM REGISTRO',cls:'state-none',text:'Nenhuma movimentação registrada hoje.'};
}

function renderMetrics(){
  const m=dashboard.metrics;const guardian=currentUser.role==='RESPONSAVEL';
  const cards=[
    ['i-users',m.students,guardian?'Meus filhos':'Alunos no escopo','Estudantes ativos acessíveis','students'],
    ['i-in',m.dentroHoje,'DENTRO*','Último registro do dia = entrada',guardian?'students':'presence'],
    ['i-out',m.foraHoje,'FORA*','Último registro do dia = saída','reports'],
    ['i-clock',m.semRegistroHoje,'Sem registro hoje','Não significa ausência','students'],
    ['i-bell',m.notificacoesNaoLidas,'Avisos não lidos','Notificações da sua conta','notifications']
  ];
  $('metrics').innerHTML=cards.map(([ic,value,label,context,view],index)=>`<button type="button" class="metric-card metric-${index}" data-go="${view}"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><span class="metric-label">${label}</span><strong>${value}</strong><span class="metric-context">${context}</span></span><span class="metric-chevron">${icon('i-arrow')}</span></button>`).join('');
  $('notifBadge').textContent=m.notificacoesNaoLidas;$('notifBadge').classList.toggle('hidden',m.notificacoesNaoLidas===0);
  $('headerNotifCount').textContent=m.notificacoesNaoLidas;$('headerNotifCount').classList.toggle('hidden',m.notificacoesNaoLidas===0);
}
function renderQuickActions(){
  const role=currentUser.role;
  const actions=role==='RESPONSAVEL'?
    [['i-users','Meus filhos','Acompanhar movimentações','students'],['i-bell','Notificações','Ver avisos recentes','notifications'],['i-message','Comunicação','Falar com a escola','messages'],['i-chart','Histórico','Filtrar movimentações','reports']]:
    role==='PORTARIA'?
    [['i-scan','Nova movimentação','Token ou QR','presence'],['i-users','Consultar aluno','Localizar cadastro ativo','students'],['i-chart','Histórico','Ver registros da portaria','reports'],['i-message','Comunicação','Falar com gestão/famílias','messages']]:
    [['i-users','Cadastrar aluno','Aluno + responsáveis','students-new'],['i-scan','Nova movimentação','Operação de portaria','presence'],['i-users','Responsáveis','Contas e convites','guardians'],['i-chart','Relatórios','Filtros e CSV','reports']];
  $('quickActions').innerHTML=actions.map(([ic,title,desc,view])=>`<button type="button" class="quick-action" data-go="${view}"><span class="quick-action-icon">${icon(ic)}</span><span><strong>${title}</strong><small>${desc}</small></span><span class="quick-action-arrow">${icon('i-arrow')}</span></button>`).join('');
}
function renderAttention(){
  const items=dashboard.attention||[];$('attentionCount').textContent=items.filter(x=>x.type!=='ok').reduce((a,b)=>a+(b.count||0),0);
  $('attentionList').innerHTML=items.map(item=>`<article class="attention-item ${item.type}"><span class="attention-icon">${icon(item.type==='ok'?'i-check':item.type==='warning'?'i-clock':'i-bell')}</span><span class="attention-copy"><strong>${escapeHtml(item.label)}${item.count?` <b>${item.count}</b>`:''}</strong><small>${escapeHtml(item.description)}</small></span><button type="button" class="text-btn" data-go="${item.view}">${escapeHtml(item.action)} ${icon('i-arrow')}</button></article>`).join('');
}
function renderChart(){
  const days=dashboard.weeklyMovements||[];const highest=Math.max(1,...days.flatMap(d=>[d.entradas,d.saidas]));
  $('activityChart').innerHTML=`<div class="chart-bars">${days.map(day=>{const date=new Date(`${day.date}T12:00:00Z`);const label=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'}).format(date).replace('.','');return `<div class="chart-day"><div class="bar-pair"><i class="bar entry" style="height:${Math.max(4,(day.entradas/highest)*100)}%" title="${day.entradas} entradas"></i><i class="bar exit" style="height:${Math.max(4,(day.saidas/highest)*100)}%" title="${day.saidas} saídas"></i></div><span>${label}</span><small>${day.entradas}/${day.saidas}</small></div>`}).join('')}</div>`;
  const totalIn=days.reduce((a,d)=>a+d.entradas,0),totalOut=days.reduce((a,d)=>a+d.saidas,0);$('trendSummary').innerHTML=`<span><b>${totalIn}</b> entradas</span><span><b>${totalOut}</b> saídas</span><span>últimos 7 dias</span>`;
}
function renderClasses(){
  const rows=dashboard.classOperational||[];$('classOverview').innerHTML=rows.map(row=>`<div class="class-row"><div><strong>${escapeHtml(row.name)}</strong><small>${row.students} alunos</small></div><div class="class-stats"><span><b>${row.entradasSemSaida}</b> entrada pendente</span><span><b>${row.saidas}</b> saída registrada</span><span><b>${row.semRegistro}</b> sem registro</span></div></div>`).join('')||'<p class="empty">Sem turmas no escopo.</p>';
}
function renderTimeline(){const items=dashboard.timeline||[];$('dashboardTimeline').innerHTML=items.map(item=>`<button type="button" class="timeline-row dashboard-timeline-row" data-go="${item.view}"><span class="event-icon ${item.type==='saida'?'exit':''}">${icon(item.type==='entrada'?'i-in':item.type==='mensagem'?'i-message':item.type==='notificacao'?'i-bell':'i-out')}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><span class="event-time">${fmt(item.createdAt)}</span></button>`).join('')||'<p class="empty">Nenhum acontecimento recente.</p>'}
function renderRecentCommunication(){
  $('recentMessages').innerHTML=(dashboard.recentMessages||[]).map(m=>`<article class="list-card"><strong>${m.ownMessage?'Para':'De'} ${escapeHtml(m.ownMessage?m.toName:m.fromName)}</strong><small>${fmt(m.createdAt)}</small><p>${escapeHtml(m.text)}</p></article>`).join('')||'<p class="empty">Nenhuma mensagem recente.</p>';
  $('recentNotifications').innerHTML=(dashboard.notifications||[]).slice(0,4).map(n=>`<article class="list-card ${n.read?'':'unread'}"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.student)} · ${fmt(n.createdAt)}</small><p>${escapeHtml(n.message)}</p></article>`).join('')||'<p class="empty">Nenhuma notificação.</p>';
}
function renderStudentPulse(){
  const rows=dashboard.studentStatuses||[];
  $('studentPulse').innerHTML=rows.map(s=>{const meta=statusMeta(s.state);return `<button type="button" class="student-pulse-card" data-go="students"><span class="student-avatar">${initials(s.name)}</span><span><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.className)}</small><em class="movement-state ${meta.cls}">${meta.label}</em><small>${s.lastTimestamp?fmt(s.lastTimestamp):'Sem movimentação hoje'}</small></span></button>`}).join('')||'<p class="empty">Nenhum estudante no escopo.</p>';
}
function renderDashboard(){
  $('dashboardSchool').textContent=dashboard.school?.name||'Unidade escolar';$('headerSchool').textContent=dashboard.school?.name||'Unidade escolar';
  $('heroDate').textContent=new Date().toLocaleDateString('pt-BR',{timeZone:schoolTimeZone,weekday:'long',day:'2-digit',month:'long'});
  if(currentUser.role==='RESPONSAVEL'){$('dashboardHeadline').textContent='Acompanhe seus filhos com clareza.';$('dashboardDescription').textContent='Veja o último registro do dia, notificações e comunicação com a escola.'}
  else if(currentUser.role==='PORTARIA'){$('dashboardHeadline').textContent='Operação rápida, sequência validada.';$('dashboardDescription').textContent='Localize o estudante, registre a próxima movimentação válida e mantenha a rastreabilidade.'}
  else{$('dashboardHeadline').textContent='Acompanhe o que exige ação da gestão.';$('dashboardDescription').textContent='Cadastros, responsáveis, movimentações, comunicação e rastreabilidade em um único painel.'}
  renderMetrics();renderQuickActions();renderAttention();renderChart();renderClasses();renderTimeline();renderRecentCommunication();renderStudentPulse();renderPresenceRecent();
}
async function loadDashboard(){dashboard=await api('/api/dashboard');schoolTimeZone=dashboard.school?.timeZone||schoolTimeZone;$('todayChip').textContent=new Date().toLocaleDateString('pt-BR',{timeZone:schoolTimeZone,weekday:'short',day:'2-digit',month:'short'});showShell(true);applyRole();renderDashboard()}

async function ensureStudents(){if(!students.length)await loadStudents(false)}
async function loadStudents(render=true){
  const result=await api('/api/students');students=result.students||[];
  if(isManager()){
    const [classes,guardians]=await Promise.all([api('/api/classes'),api('/api/guardians')]);classCatalog=classes.classes||[];guardianCatalog=guardians.guardians||[];invitationCatalog=guardians.invitations||[];
  }else{classCatalog=[...new Map(students.map(s=>[s.classId,{id:s.classId,name:s.className,shift:''}])).values()]}
  fillStudentSelectors();if(render)renderStudents(students);
}
function fillStudentSelectors(){
  const classOptions=classCatalog.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}${c.shift?` · ${escapeHtml(c.shift)}`:''}</option>`).join('');
  ['newStudentClass','editStudentClass'].forEach(id=>{if($(id))$(id).innerHTML=classOptions});
  if($('reportClass'))$('reportClass').innerHTML='<option value="">Todas</option>'+classCatalog.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const studentOptions=students.filter(s=>s.status==='ATIVO').map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.className)}</option>`).join('');
  if($('reportStudent'))$('reportStudent').innerHTML='<option value="">Todos</option>'+studentOptions;
  if($('notifStudentFilter'))$('notifStudentFilter').innerHTML='<option value="">Todos</option>'+studentOptions;
  if($('linkStudent'))$('linkStudent').innerHTML=studentOptions;
  const tokenOptions=students.filter(s=>s.status==='ATIVO'&&s.token).map(s=>`<option value="${escapeHtml(s.token)}">${escapeHtml(s.name)} · ${escapeHtml(s.className)}</option>`).join('');$('studentTokenOptions').innerHTML=tokenOptions;
  $('quickTokens').innerHTML=students.filter(s=>s.status==='ATIVO'&&s.token).slice(0,8).map(s=>`<button type="button" class="token-btn" data-token="${escapeHtml(s.token)}">${escapeHtml(s.name)}</button>`).join('');
  const activeGuardians=guardianCatalog.filter(g=>g.status==='ATIVO');const guardianOptions=activeGuardians.map(g=>`<option value="${g.id}">${escapeHtml(g.name)} · ${escapeHtml(g.email)}</option>`).join('');
  if($('studentGuardianId'))$('studentGuardianId').innerHTML=guardianOptions;if($('linkGuardian'))$('linkGuardian').innerHTML=guardianOptions;
}
function renderStudents(list){
  if(currentUser.role==='RESPONSAVEL'){
    $('studentsHeading').textContent='Meus filhos';$('studentsHelper').textContent='Somente estudantes explicitamente vinculados à sua conta.';
    const statusById=new Map((dashboard?.studentStatuses||[]).map(s=>[s.id,s]));
    $('studentsTable').className='child-grid';$('studentsTable').innerHTML=list.map(s=>{const st=statusById.get(s.id)||{};const meta=statusMeta(st.state);return `<article class="child-card"><div class="student-identity"><span class="student-avatar">${initials(s.name)}</span><div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.className)} · Matrícula ${escapeHtml(s.enrollment)}</p></div></div><div class="child-status"><span class="movement-state ${meta.cls}">${meta.label}</span><small>${meta.text}</small><b>${st.lastTimestamp?fmt(st.lastTimestamp):'Sem horário registrado hoje'}</b></div><div class="child-actions"><button class="btn secondary" type="button" data-go="reports">Ver histórico</button><button class="btn secondary" type="button" data-go="notifications">Notificações</button></div><p class="status-disclaimer">*Estado operacional derivado do último registro de portaria; não é rastreamento em tempo real.</p></article>`}).join('')||'<p class="empty">Nenhum aluno vinculado.</p>';return;
  }
  $('studentsHeading').textContent='Alunos';$('studentsHelper').textContent=currentUser.role==='PORTARIA'?'Alunos ativos disponíveis para operação.':'Cadastros, situação e responsáveis vinculados.';
  $('studentsTable').className='table-wrap';
  const manager=isManager();
  $('studentsTable').innerHTML=`<table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Turma</th>${isOperator()?'<th>Token</th>':''}<th>Situação</th>${manager?'<th>Responsáveis</th><th>Ações</th>':''}</tr></thead><tbody>${list.map(s=>`<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.enrollment)}</td><td>${escapeHtml(s.className)}</td>${isOperator()?`<td><code>${escapeHtml(s.token||'-')}</code></td>`:''}<td><span class="status-pill ${s.status==='ATIVO'?'':'is-inactive'}">${escapeHtml(s.status)}</span></td>${manager?`<td><div class="inline-students">${(s.guardians||[]).map(g=>`<span class="chip">${escapeHtml(g.name)} <small>${g.status==='CONVITE_PENDENTE'?'convite':'ativo'}</small></span>`).join('')||'<span class="status-pill is-danger">Sem responsável</span>'}</div></td><td><div class="table-actions"><button class="btn secondary student-action" data-student-edit="${s.id}">Editar</button><button class="btn secondary student-action" data-student-link="${s.id}">+ Responsável</button></div></td>`:''}</tr>`).join('')}</tbody></table>`;
}
function filterStudents(){const term=$('studentSearch').value.trim().toLocaleLowerCase('pt-BR');renderStudents(students.filter(s=>[s.name,s.enrollment,s.className,s.token].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term))))}

function updateWizard(){
  [1,2,3].forEach(n=>{$(`studentWizardStep${n}`).classList.toggle('hidden',n!==wizardStep);document.querySelector(`[data-wizard-indicator="${n}"]`).classList.toggle('active',n===wizardStep);document.querySelector(`[data-wizard-indicator="${n}"]`).classList.toggle('done',n<wizardStep)});
  $('wizardBackBtn').classList.toggle('hidden',wizardStep===1);$('wizardNextBtn').classList.toggle('hidden',wizardStep===3);$('saveStudentBtn').classList.toggle('hidden',wizardStep!==3);
  if(wizardStep===3)renderStudentReview();
}
function resetWizard(){wizardStep=1;guardianDrafts=[];$('newStudentName').value='';$('newStudentEnrollment').value='';['newGuardianName','newGuardianEmail','newGuardianPhone','newGuardianCpf'].forEach(id=>$(id).value='');renderGuardianDrafts();updateWizard()}
function openStudentForm(){resetWizard();$('studentFormPanel').classList.remove('hidden');$('invitationResult').classList.add('hidden');$('editStudentPanel').classList.add('hidden');$('studentFormPanel').scrollIntoView({behavior:'smooth',block:'start'});$('newStudentName').focus()}
function validateStep1(){if(!$('newStudentName').value.trim()||$('newStudentEnrollment').value.trim().length<3||!$('newStudentClass').value){toast('Preencha nome, matrícula e turma.');return false}return true}
function toggleGuardianFields(){const existing=$('guardianMode').value==='existing';$('guardianNewFields').classList.toggle('hidden',existing);$('guardianExistingFields').classList.toggle('hidden',!existing)}
function addGuardianDraft(){
  if($('guardianMode').value==='existing'){
    const id=$('studentGuardianId').value;const g=guardianCatalog.find(x=>x.id===id);if(!g)return toast('Selecione um responsável ativo.');if(guardianDrafts.some(x=>x.mode==='existing'&&x.guardianId===id))return toast('Este responsável já foi adicionado.');guardianDrafts.push({mode:'existing',guardianId:id,label:g.name,detail:g.email});
  }else{
    const draft={mode:'new',name:$('newGuardianName').value.trim(),email:$('newGuardianEmail').value.trim().toLowerCase(),phone:$('newGuardianPhone').value.trim(),relationship:$('newGuardianRelation').value,cpf:$('newGuardianCpf').value.trim()};
    if(draft.name.length<3||!draft.email.includes('@')||draft.phone.replace(/\D/g,'').length<10)return toast('Preencha nome, e-mail e telefone válidos do responsável.');
    if(guardianDrafts.some(x=>x.mode==='new'&&(x.email===draft.email||(draft.cpf&&x.cpf===draft.cpf))))return toast('Este responsável já foi adicionado.');
    guardianDrafts.push({...draft,label:draft.name,detail:`${draft.relationship} · ${draft.email}`});['newGuardianName','newGuardianEmail','newGuardianPhone','newGuardianCpf'].forEach(id=>$(id).value='');
  }
  renderGuardianDrafts();
}
function renderGuardianDrafts(){
  $('guardianDraftCount').textContent=`${guardianDrafts.length} adicionado${guardianDrafts.length===1?'':'s'}`;
  $('guardianDraftList').innerHTML=guardianDrafts.map((g,i)=>`<div class="guardian-draft"><span>${icon('i-users')}</span><div><strong>${escapeHtml(g.label)}</strong><small>${escapeHtml(g.detail)}</small></div><button type="button" class="icon-btn" data-remove-guardian="${i}" aria-label="Remover responsável">${icon('i-close')}</button></div>`).join('')||'<p class="empty">Adicione pelo menos um responsável para continuar.</p>';
}
function renderStudentReview(){const cls=classCatalog.find(c=>c.id===$('newStudentClass').value);$('studentReview').innerHTML=`<div class="review-section"><span class="eyebrow">Aluno</span><h3>${escapeHtml($('newStudentName').value.trim())}</h3><p>Matrícula ${escapeHtml($('newStudentEnrollment').value.trim())} · ${escapeHtml(cls?.name||'Turma')}</p></div><div class="review-section"><span class="eyebrow">Responsáveis (${guardianDrafts.length})</span>${guardianDrafts.map(g=>`<div class="review-person"><strong>${escapeHtml(g.label)}</strong><small>${escapeHtml(g.detail)}</small><span class="status-pill ${g.mode==='existing'?'':'is-pending'}">${g.mode==='existing'?'Vincular conta':'Gerar convite'}</span></div>`).join('')}</div>`}
function presentInvitations(items){latestInvitations=(items||[]).filter(Boolean);if(!latestInvitations.length){$('invitationResult').classList.add('hidden');return}$('invitationResult').classList.remove('hidden');$('invitationResults').innerHTML=latestInvitations.map(result=>`<div class="invitation-card"><span class="eyebrow">${escapeHtml(result.invitation?.name||'Responsável')}</span><strong class="invitation-code">${escapeHtml(result.activationCode)}</strong><small>${escapeHtml(result.invitation?.email||'')} · expira em ${fmtDate(result.invitation?.expiresAt)}</small></div>`).join('');$('invitationResult').scrollIntoView({behavior:'smooth',block:'start'})}

async function loadGuardians(){const data=await api('/api/guardians');guardianCatalog=data.guardians||[];invitationCatalog=data.invitations||[];fillStudentSelectors();renderGuardians()}
function renderGuardians(){
  const active=guardianCatalog.filter(g=>g.status==='ATIVO').length,links=guardianCatalog.reduce((sum,g)=>sum+(g.studentIds||[]).length,0),pending=invitationCatalog.length,expiring=invitationCatalog.filter(i=>i.daysToExpire<=7).length;
  $('guardianSummary').innerHTML=[[active,'Contas de responsáveis'],[links,'Vínculos ativos'],[pending,'Convites pendentes'],[expiring,'Expiram em até 7 dias']].map(([v,l])=>`<article class="summary-card"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('guardiansTable').innerHTML=`<table><thead><tr><th>Responsável</th><th>Contato</th><th>Filhos vinculados</th><th>Último acesso</th><th>Situação</th></tr></thead><tbody>${guardianCatalog.map(g=>`<tr><td><strong>${escapeHtml(g.name)}</strong>${g.cpfMasked?`<small>${escapeHtml(g.cpfMasked)}</small>`:''}</td><td>${escapeHtml(g.email)}<br><small>${escapeHtml(g.phone||'-')}</small></td><td><div class="inline-students">${(g.students||[]).map(s=>`<span class="chip">${escapeHtml(s.name)}${s.status!=='ATIVO'?` · ${s.status}`:''}<button type="button" data-unlink-user="${g.id}" data-unlink-student="${s.id}" aria-label="Remover vínculo">${icon('i-close')}</button></span>`).join('')||'<span class="hint">Nenhum vínculo</span>'}</div></td><td>${g.lastLoginAt?fmt(g.lastLoginAt):'Ainda não registrado'}</td><td><span class="status-pill ${g.status==='ATIVO'?'':'is-inactive'}">${escapeHtml(g.status)}</span></td></tr>`).join('')}</tbody></table>`;
  $('invitationsTable').innerHTML=invitationCatalog.map(i=>`<article class="invitation-manage-card ${i.daysToExpire<=7?'expiring':''}"><div><span class="status-pill is-pending">Convite pendente</span><h3>${escapeHtml(i.name)}</h3><p>${escapeHtml(i.email)} · ${escapeHtml(i.relationship||'Responsável')}</p><div class="inline-students">${(i.students||[]).map(s=>`<span class="chip">${escapeHtml(s.name)}</span>`).join('')}</div></div><div class="invite-expiry"><strong>${i.daysToExpire}</strong><span>dias para expirar</span></div><div class="table-actions"><button class="btn secondary student-action" data-renew="${i.id}">Renovar</button><button class="btn secondary student-action" data-revoke="${i.id}">Revogar</button></div></article>`).join('')||'<p class="empty">Nenhum convite pendente.</p>';
}

async function lookupPresenceStudent(token,method='TOKEN_MANUAL'){
  const value=String(token||$('studentToken').value).trim();if(!value)return toast('Informe ou selecione um token.');
  try{const data=await api(`/api/attendance/status?token=${encodeURIComponent(value)}`);selectedPresence=data;presenceMethod=method;$('studentToken').value=data.student.token||value;renderPresenceSelection()}catch(e){selectedPresence=null;$('presenceStudentCard').classList.add('hidden');toast(e.message)}
}
function renderPresenceSelection(){if(!selectedPresence)return;const {student,status}=selectedPresence;const meta=statusMeta(status.state);$('presenceStudentInitials').textContent=initials(student.name);$('presenceStudentName').textContent=student.name;$('presenceStudentMeta').textContent=`${student.className} · matrícula ${student.enrollment}`;$('presenceStateBadge').className=`movement-state ${meta.cls}`;$('presenceStateBadge').textContent=meta.label;$('presenceLastMovement').textContent=status.lastTimestamp?`${meta.text} ${fmt(status.lastTimestamp)}`:meta.text;$('presenceNextAction').textContent=status.nextType;$('registerBtn').textContent=`Registrar ${status.nextType.toLowerCase()}`;$('registerBtn').dataset.type=status.nextType;$('presenceStudentCard').classList.remove('hidden');$('registerFeedback').textContent='';$('registerFeedback').className='feedback'}
function renderPresenceRecent(){if(!$('portariaRecent')||!dashboard)return;const rows=(dashboard.attendance||[]).slice(0,8);$('portariaRecent').innerHTML=rows.map(r=>`<div class="recent-operation"><span class="event-icon ${r.type==='SAIDA'?'exit':''}">${icon(r.type==='ENTRADA'?'i-in':'i-out')}</span><span><strong>${escapeHtml(r.student)}</strong><small>${r.type} · ${fmt(r.timestamp)}</small></span></div>`).join('')||'<p class="empty">Sem movimentações no escopo.</p>'}
async function startQrScanner(){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){toast('Leitura por câmera não está disponível neste navegador. Use o token manual.');return}
  try{
    const formats=await BarcodeDetector.getSupportedFormats();if(!formats.includes('qr_code'))throw new Error('QR Code não suportado neste navegador.');
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});$('qrVideo').srcObject=qrStream;await $('qrVideo').play();$('qrScannerPanel').classList.remove('hidden');$('qrScannerStatus').textContent='Aponte a câmera para o QR que contém o token Safe Student.';
    const detector=new BarcodeDetector({formats:['qr_code']});
    const scan=async()=>{if(!qrStream)return;try{const codes=await detector.detect($('qrVideo'));if(codes.length){const raw=String(codes[0].rawValue||'').trim();if(raw){stopQrScanner();$('studentToken').value=raw;await lookupPresenceStudent(raw,'QR_CAMERA');return}}}catch{}qrLoop=setTimeout(scan,250)};scan();
  }catch(e){stopQrScanner();toast(e.message||'Não foi possível abrir a câmera.')}
}
function stopQrScanner(){if(qrLoop){clearTimeout(qrLoop);qrLoop=null}if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null}if($('qrVideo'))$('qrVideo').srcObject=null;$('qrScannerPanel').classList.add('hidden')}

async function loadNotifications(){await ensureStudents();const q=new URLSearchParams();q.set('read',$('notifReadFilter').value||'all');if($('notifStudentFilter').value)q.set('studentId',$('notifStudentFilter').value);const data=await api(`/api/notifications?${q}`);notifications=data.notifications||[];$('notificationsList').innerHTML=notifications.map(n=>`<article class="notification-card ${n.read?'':'unread'}"><div class="notification-icon">${icon(n.title.toLowerCase().includes('saída')?'i-out':'i-in')}</div><div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.student)} · ${fmt(n.createdAt)}</small><p>${escapeHtml(n.message)}</p></div>${!n.read?`<button class="btn secondary student-action mark-read" data-id="${n.id}">Marcar como lida</button>`:''}</article>`).join('')||'<p class="empty">Nenhuma notificação encontrada com estes filtros.</p>'}

function reportQuery(){const q=new URLSearchParams();[['from','reportFrom'],['to','reportTo'],['classId','reportClass'],['studentId','reportStudent'],['type','reportType']].forEach(([key,id])=>{const v=$(id).value;if(v)q.set(key,v)});const str=q.toString();return str?`?${str}`:''}
async function loadReports(){await ensureStudents();const data=await api('/api/reports'+reportQuery());reports=data.records||[];$('reportDisclaimer').textContent=data.disclaimer;const totals=data.totals||{};$('reportMetrics').innerHTML=[['i-table',totals.records||0,'Movimentações'],['i-in',totals.entradas||0,'Entradas'],['i-out',totals.saidas||0,'Saídas'],['i-users',totals.students||0,'Alunos no filtro']].map(([ic,v,l])=>`<article class="metric-card"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><strong>${v}</strong><span class="metric-context">${l}</span></span></article>`).join('');$('reportsTable').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Aluno</th><th>Turma</th><th>Tipo</th><th>Método</th><th>Registrado por</th></tr></thead><tbody>${reports.map(r=>`<tr><td>${fmt(r.timestamp)}</td><td><strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(r.enrollment)}</small></td><td>${escapeHtml(r.className)}</td><td><span class="movement-state ${r.type==='ENTRADA'?'state-in':'state-out'}">${r.type}</span></td><td>${escapeHtml(r.method)}</td><td>${escapeHtml(r.registeredBy)}</td></tr>`).join('')||'<tr><td colspan="6">Nenhum registro para os filtros selecionados.</td></tr>'}</tbody></table>`}

async function loadMessages(){
  const [m,d]=await Promise.all([api('/api/messages'),api('/api/directory')]);allMessages=m.messages||[];messageDirectory=d.people||[];
  if(selectedMessagePeer&&!messageDirectory.some(p=>p.id===selectedMessagePeer))selectedMessagePeer=null;if(!selectedMessagePeer&&messageDirectory.length)selectedMessagePeer=messageDirectory[0].id;renderConversationContacts();renderConversation();
}
function renderConversationContacts(){const latest=new Map();allMessages.forEach(m=>{const peer=m.fromUserId===currentUser.id?m.toUserId:m.fromUserId;latest.set(peer,m)});$('conversationContacts').innerHTML=messageDirectory.map(p=>{const last=latest.get(p.id);return `<button type="button" class="contact-card ${selectedMessagePeer===p.id?'active':''}" data-peer="${p.id}"><span class="student-avatar">${initials(p.name)}</span><span><strong>${escapeHtml(p.name)}</strong><small>${roleName(p.role)}</small><em>${last?escapeHtml(last.text.slice(0,52)):'Iniciar conversa'}</em></span></button>`}).join('')||'<p class="empty">Nenhum contato permitido.</p>'}
function renderConversation(){const peer=messageDirectory.find(p=>p.id===selectedMessagePeer);if(!peer){$('conversationTitle').textContent='Selecione um contato';$('conversationSubtitle').textContent='Escolha ao lado com quem deseja conversar.';$('messagesList').innerHTML='<p class="empty">Nenhuma conversa selecionada.</p>';$('messageComposer').classList.add('hidden');return}$('conversationTitle').textContent=peer.name;$('conversationSubtitle').textContent=roleName(peer.role);const thread=allMessages.filter(m=>(m.fromUserId===currentUser.id&&m.toUserId===peer.id)||(m.fromUserId===peer.id&&m.toUserId===currentUser.id));$('messagesList').innerHTML=thread.map(m=>`<article class="chat-bubble ${m.fromUserId===currentUser.id?'mine':'theirs'}"><p>${escapeHtml(m.text)}</p><small>${fmt(m.createdAt)}</small></article>`).join('')||'<p class="empty">Ainda não há mensagens nesta conversa.</p>';$('messageComposer').classList.remove('hidden');$('messagesList').scrollTop=$('messagesList').scrollHeight}

function auditQuery(){const q=new URLSearchParams();[['q','auditSearch'],['action','auditAction'],['userId','auditUser'],['from','auditFrom'],['to','auditTo']].forEach(([key,id])=>{const v=$(id).value;if(v)q.set(key,v)});return q.toString()?`?${q}`:''}
async function loadAudit(){if(!isManager())return;const data=await api('/api/audit'+auditQuery());const currentAction=$('auditAction').value,currentUserFilter=$('auditUser').value;$('auditAction').innerHTML='<option value="">Todas</option>'+(data.actions||[]).map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');$('auditUser').innerHTML='<option value="">Todos</option>'+(data.users||[]).map(u=>`<option value="${u.id}">${escapeHtml(u.name)} · ${roleName(u.role)}</option>`).join('');$('auditAction').value=currentAction;$('auditUser').value=currentUserFilter;$('auditTable').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>${(data.rows||[]).map(a=>`<tr><td>${fmt(a.createdAt)}</td><td>${escapeHtml(a.userName)}</td><td><code>${escapeHtml(a.action)}</code></td><td>${escapeHtml(a.entity||'-')}</td><td>${escapeHtml(a.details||'-')}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum evento encontrado.</td></tr>'}</tbody></table>`}

async function loadFeedback(){const d=await api('/api/feedback');feedbacks=d.rows||[];$('feedbackMetrics').innerHTML=[['i-star',d.avg||0,'nota média coletada'],['i-table',d.total||0,'avaliações coletadas'],['i-check',(d.successRate||0)+'%','sucesso nas tarefas'],['i-clock',d.avgTimeSeconds?d.avgTimeSeconds+'s':'-','tempo médio']].map(c=>`<article class="metric-card"><span class="metric-icon">${icon(c[0])}</span><span class="metric-content"><strong>${c[1]}</strong><span class="metric-context">${c[2]}</span></span></article>`).join('');$('feedbackDisclaimer').textContent=`${d.disclaimer} Registros ilustrativos na base: ${d.demoSeedCount||0}.`;$('feedbackList').innerHTML=feedbacks.slice(0,12).map(f=>`<article class="list-card"><strong>${escapeHtml(f.profile)} · Nota ${f.score}/5</strong><small>${escapeHtml(f.scenario||'Cenário não informado')} · ${fmt(f.createdAt)}</small><p>${escapeHtml(f.comment)}</p></article>`).join('')||'<p class="empty">Sem avaliações coletadas.</p>'}

function configureQuickAction(){const manager=isManager();const primary=$('primaryActionBtn'),hero=$('heroActionBtn');if(manager){primary.textContent='+ Cadastrar aluno';primary.dataset.go='students-new';hero.querySelector('span').textContent='Cadastrar aluno';hero.dataset.go='students-new'}else if(isOperator()){primary.textContent='+ Nova movimentação';primary.dataset.go='presence';hero.querySelector('span').textContent='Nova movimentação';hero.dataset.go='presence'}else{primary.classList.add('permission-hidden');hero.classList.add('permission-hidden')}}
async function login(email,password){const d=await api('/api/login',{method:'POST',body:JSON.stringify({email,password})});currentUser=d.user;await loadDashboard();await goView('dashboard')}
function logoutLocal(){stopQrScanner();currentUser=null;dashboard=null;students=[];guardianCatalog=[];messageDirectory=[];selectedMessagePeer=null;$('globalSearch').value='';showShell(false)}

function renderGlobalSearchResults(data){const groups=[['Alunos',data.students||[],item=>`${item.name} · ${item.className}`],['Responsáveis',data.guardians||[],item=>`${item.name} · ${item.email}`],['Registros',data.records||[],item=>`${item.title} · ${item.description}`],['Mensagens',data.messages||[],item=>item.description]];const items=groups.flatMap(([group,list,label])=>list.map(item=>({label:label(item),view:item.view,group,id:item.id})));$('globalSearchResults').innerHTML=items.length?items.map(item=>`<button type="button" class="search-result" data-search-view="${item.view}" data-search-id="${item.id}"><small>${item.group}</small><strong>${escapeHtml(item.label)}</strong></button>`).join(''):'<p class="search-empty">Nenhum resultado encontrado.</p>';$('globalSearchResults').classList.remove('hidden')}
async function executeGlobalSearch(){const term=$('globalSearch').value.trim();if(term.length<2){$('globalSearchResults').classList.add('hidden');return}try{renderGlobalSearchResults(await api(`/api/search?q=${encodeURIComponent(term)}`))}catch(e){toast(e.message)}}
function syncThemeIcon(){const use=$('themeBtn').querySelector('use');use.setAttribute('href',document.documentElement.dataset.theme==='dark'?'#i-moon':'#i-sun')}

// Navegação e ações globais
qsa('.nav-item').forEach(btn=>btn.addEventListener('click',()=>goView(btn.dataset.view)));
document.addEventListener('click',event=>{
  const go=event.target.closest('[data-go]');if(go){const view=go.dataset.go;if(view==='students-new'){goView('students').then(openStudentForm)}else goView(view);return}
  const result=event.target.closest('[data-search-view]');if(result){$('globalSearchResults').classList.add('hidden');goView(result.dataset.searchView);return}
  if(!event.target.closest('.global-search'))$('globalSearchResults').classList.add('hidden');
});
$('mobileNavBtn').addEventListener('click',()=>{const open=document.body.classList.toggle('mobile-nav-open');$('mobileNavBtn').setAttribute('aria-expanded',String(open));$('mobileNavBtn').setAttribute('aria-label',open?'Fechar menu':'Abrir menu')});
$('headerNotifications').addEventListener('click',()=>goView('notifications'));
$('globalSearchBtn').addEventListener('click',executeGlobalSearch);$('globalSearch').addEventListener('input',()=>{clearTimeout(window.__searchTimer);window.__searchTimer=setTimeout(executeGlobalSearch,220)});$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Escape')$('globalSearchResults').classList.add('hidden')});
$('themeBtn').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('ss_theme',document.documentElement.dataset.theme);syncThemeIcon()});document.documentElement.dataset.theme=localStorage.getItem('ss_theme')||'light';syncThemeIcon();
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'})}catch{}logoutLocal()});

// Login, recuperação e ativação
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';setBusy($('loginSubmitBtn'),true,'Entrando...');try{await login($('email').value,$('password').value)}catch(err){$('loginError').textContent=err.message}finally{setBusy($('loginSubmitBtn'),false)}});
qsa('.demo-card').forEach(btn=>btn.addEventListener('click',async()=>{setBusy(btn,true,'Entrando...');try{await login(btn.dataset.login,'demo123')}catch(e){$('loginError').textContent=e.message}finally{setBusy(btn,false)}}));
$('togglePassword').addEventListener('click',()=>{const visible=$('password').type==='text';$('password').type=visible?'password':'text';$('togglePassword').textContent=visible?'Mostrar senha':'Ocultar senha';$('togglePassword').setAttribute('aria-pressed',String(!visible))});
$('forgotPasswordBtn').addEventListener('click',()=>{$('loginForm').classList.add('hidden');$('passwordResetForm').classList.remove('hidden');$('resetEmail').value=$('email').value;$('resetEmail').focus()});
$('backFromResetBtn').addEventListener('click',()=>{$('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden')});
$('requestResetBtn').addEventListener('click',async()=>{$('resetError').textContent='';try{const d=await api('/api/password/forgot',{method:'POST',body:JSON.stringify({email:$('resetEmail').value})});$('resetCodeArea').classList.remove('hidden');$('resetDemoCode').textContent=d.demoCode?`Código de demonstração: ${d.demoCode}`:'Código gerado para a conta, se ela existir.'}catch(e){$('resetError').textContent=e.message}});
$('passwordResetForm').addEventListener('submit',async e=>{e.preventDefault();$('resetError').textContent='';try{await api('/api/password/reset',{method:'POST',body:JSON.stringify({email:$('resetEmail').value,code:$('resetCode').value,password:$('resetPassword').value,confirmPassword:$('resetConfirm').value})});toast('Senha redefinida. Entre novamente.');$('passwordResetForm').reset();$('resetCodeArea').classList.add('hidden');$('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden')}catch(err){$('resetError').textContent=err.message}});
$('showRegisterBtn').addEventListener('click',()=>{$('loginForm').classList.add('hidden');$('guardianRegisterForm').classList.remove('hidden');$('regEmail').focus()});$('backLoginBtn').addEventListener('click',()=>{$('guardianRegisterForm').classList.add('hidden');$('loginForm').classList.remove('hidden')});
$('guardianRegisterForm').addEventListener('submit',async e=>{e.preventDefault();setBusy($('registerGuardianBtn'),true,'Ativando...');$('registerError').textContent='';try{const d=await api('/api/guardian/register',{method:'POST',body:JSON.stringify({email:$('regEmail').value,code:$('regCode').value,password:$('regPassword').value,confirmPassword:$('regConfirm').value,cpf:$('regCpf').value})});currentUser=d.user;$('guardianRegisterForm').reset();$('guardianRegisterForm').classList.add('hidden');$('loginForm').classList.remove('hidden');await loadDashboard();await goView('students');toast('Conta ativada. Seus filhos vinculados já estão disponíveis.')}catch(err){$('registerError').textContent=err.message}finally{setBusy($('registerGuardianBtn'),false)}});

// Portaria
$('lookupStudentBtn').addEventListener('click',()=>lookupPresenceStudent());$('studentToken').addEventListener('change',()=>{presenceMethod='TOKEN_MANUAL';if($('studentToken').value.trim())lookupPresenceStudent()});$('studentToken').addEventListener('input',()=>{presenceMethod='TOKEN_MANUAL';selectedPresence=null;$('presenceStudentCard').classList.add('hidden')});$('quickTokens').addEventListener('click',e=>{const btn=e.target.closest('[data-token]');if(btn){$('studentToken').value=btn.dataset.token;lookupPresenceStudent(btn.dataset.token)}});$('startQrScannerBtn').addEventListener('click',startQrScanner);$('stopQrScannerBtn').addEventListener('click',stopQrScanner);
$('registerBtn').addEventListener('click',async()=>{if(!selectedPresence)return toast('Localize o estudante primeiro.');const type=$('registerBtn').dataset.type;setBusy($('registerBtn'),true,'Registrando...');try{const d=await api('/api/attendance',{method:'POST',body:JSON.stringify({token:selectedPresence.student.token,type,method:presenceMethod})});$('registerFeedback').textContent=`${type} registrada às ${fmt(d.record.timestamp)}. ${d.notified} responsável(is) notificado(s).`;$('registerFeedback').className='feedback ok';selectedPresence.status=d.status;presenceMethod='TOKEN_MANUAL';renderPresenceSelection();await loadDashboard()}catch(e){$('registerFeedback').textContent=e.message;$('registerFeedback').className='feedback err'}finally{setBusy($('registerBtn'),false);if(selectedPresence)renderPresenceSelection()}});

// Alunos e vínculos
$('studentSearch').addEventListener('input',filterStudents);$('newStudentBtn').addEventListener('click',openStudentForm);$('cancelStudentBtn').addEventListener('click',()=>{$('studentFormPanel').classList.add('hidden')});$('guardianMode').addEventListener('change',toggleGuardianFields);$('addGuardianDraftBtn').addEventListener('click',addGuardianDraft);
$('wizardNextBtn').addEventListener('click',()=>{if(wizardStep===1&&!validateStep1())return;if(wizardStep===2&&!guardianDrafts.length)return toast('Adicione pelo menos um responsável.');wizardStep=Math.min(3,wizardStep+1);updateWizard()});$('wizardBackBtn').addEventListener('click',()=>{wizardStep=Math.max(1,wizardStep-1);updateWizard()});
$('saveStudentBtn').addEventListener('click',async()=>{if(!validateStep1()||!guardianDrafts.length)return toast('Revise os dados antes de confirmar.');setBusy($('saveStudentBtn'),true,'Cadastrando...');try{const payload={name:$('newStudentName').value.trim(),enrollment:$('newStudentEnrollment').value.trim(),classId:$('newStudentClass').value,guardians:guardianDrafts.map(g=>g.mode==='existing'?{mode:'existing',guardianId:g.guardianId}:{mode:'new',name:g.name,email:g.email,phone:g.phone,relationship:g.relationship,cpf:g.cpf})};const response=await api('/api/students',{method:'POST',body:JSON.stringify(payload)});$('studentFormPanel').classList.add('hidden');await Promise.all([loadStudents(),loadDashboard()]);presentInvitations(response.invitations||[]);toast(`Aluno cadastrado com ${guardianDrafts.length} responsável(is).`);resetWizard()}catch(e){toast(e.message)}finally{setBusy($('saveStudentBtn'),false)}});
$('linkMode').addEventListener('change',()=>{const isNew=$('linkMode').value==='new';$('linkExistingFields').classList.toggle('hidden',isNew);$('linkNewFields').classList.toggle('hidden',!isNew)});$('cancelLinkBtn').addEventListener('click',()=>$('linkPanel').classList.add('hidden'));$('cancelEditStudentBtn').addEventListener('click',()=>{$('editStudentPanel').classList.add('hidden');editingStudentId=null});
$('saveEditStudentBtn').addEventListener('click',async()=>{if(!editingStudentId)return;setBusy($('saveEditStudentBtn'),true,'Salvando...');try{await api(`/api/students/${encodeURIComponent(editingStudentId)}`,{method:'PATCH',body:JSON.stringify({name:$('editStudentName').value,enrollment:$('editStudentEnrollment').value,classId:$('editStudentClass').value,status:$('editStudentStatus').value})});$('editStudentPanel').classList.add('hidden');editingStudentId=null;await Promise.all([loadStudents(),loadDashboard()]);toast('Cadastro atualizado.')}catch(e){toast(e.message)}finally{setBusy($('saveEditStudentBtn'),false)}});
$('saveLinkBtn').addEventListener('click',async()=>{setBusy($('saveLinkBtn'),true,'Salvando...');try{if($('linkMode').value==='existing'){await api('/api/links',{method:'POST',body:JSON.stringify({studentId:$('linkStudent').value,guardianId:$('linkGuardian').value})});toast('Responsável vinculado.')}else{const result=await api('/api/guardians/invitations',{method:'POST',body:JSON.stringify({studentId:$('linkStudent').value,guardian:{name:$('linkGuardianName').value,email:$('linkGuardianEmail').value,phone:$('linkGuardianPhone').value,relationship:$('linkGuardianRelation').value,cpf:$('linkGuardianCpf').value}})});presentInvitations([result]);toast('Convite gerado.')} $('linkPanel').classList.add('hidden');await Promise.all([loadStudents(),loadDashboard()])}catch(e){toast(e.message)}finally{setBusy($('saveLinkBtn'),false)}});

document.addEventListener('click',async e=>{
  const remove=e.target.closest('[data-remove-guardian]');if(remove){guardianDrafts.splice(Number(remove.dataset.removeGuardian),1);renderGuardianDrafts();return}
  const edit=e.target.closest('[data-student-edit]');if(edit){const s=students.find(x=>x.id===edit.dataset.studentEdit);if(!s)return;editingStudentId=s.id;$('editStudentName').value=s.name;$('editStudentEnrollment').value=s.enrollment;$('editStudentClass').value=s.classId;$('editStudentStatus').value=s.status;$('editStudentPanel').classList.remove('hidden');$('studentFormPanel').classList.add('hidden');$('editStudentPanel').scrollIntoView({behavior:'smooth'});return}
  const link=e.target.closest('[data-student-link]');if(link){$('linkStudent').value=link.dataset.studentLink;$('linkPanel').classList.remove('hidden');$('linkPanel').scrollIntoView({behavior:'smooth'});return}
  const unlink=e.target.closest('[data-unlink-user]');if(unlink){if(!confirm('Remover o acesso deste responsável a este estudante?'))return;try{await api('/api/links',{method:'DELETE',body:JSON.stringify({guardianId:unlink.dataset.unlinkUser,studentId:unlink.dataset.unlinkStudent})});await Promise.all([loadStudents(),loadGuardians(),loadDashboard()]);toast('Vínculo removido.')}catch(err){toast(err.message)}return}
  const renew=e.target.closest('[data-renew]');if(renew){if(!confirm('Gerar novo código e invalidar o anterior?'))return;try{const result=await api(`/api/guardians/invitations/${encodeURIComponent(renew.dataset.renew)}/renew`,{method:'POST'});presentInvitations([result]);await loadGuardians();toast('Convite renovado.')}catch(err){toast(err.message)}return}
  const revoke=e.target.closest('[data-revoke]');if(revoke){if(!confirm('Revogar este convite?'))return;try{await api(`/api/guardians/invitations/${encodeURIComponent(revoke.dataset.revoke)}`,{method:'DELETE'});await Promise.all([loadGuardians(),loadDashboard()]);toast('Convite revogado.')}catch(err){toast(err.message)}return}
  const mark=e.target.closest('.mark-read');if(mark){try{await api(`/api/notifications/${mark.dataset.id}`,{method:'PATCH'});await Promise.all([loadNotifications(),loadDashboard()]);toast('Notificação marcada como lida.')}catch(err){toast(err.message)}return}
  const peer=e.target.closest('[data-peer]');if(peer){selectedMessagePeer=peer.dataset.peer;renderConversationContacts();renderConversation();return}
});
$('refreshGuardiansBtn').addEventListener('click',()=>loadGuardians().then(()=>toast('Dados atualizados.')).catch(e=>toast(e.message)));$('copyInvitationBtn').addEventListener('click',async()=>{if(!latestInvitations.length)return;const text=latestInvitations.map(r=>`Safe Student - ativação\nResponsável: ${r.invitation.name}\nE-mail: ${r.invitation.email}\nCódigo: ${r.activationCode}\nNão compartilhe este código com terceiros.`).join('\n\n');try{await navigator.clipboard.writeText(text);toast('Instruções copiadas.')}catch{toast('Não foi possível copiar automaticamente.')}});

// Notificações, relatórios, mensagens e auditoria
$('applyNotifFilterBtn').addEventListener('click',()=>loadNotifications().catch(e=>toast(e.message)));$('applyReportBtn').addEventListener('click',()=>loadReports().catch(e=>toast(e.message)));$('clearReportBtn').addEventListener('click',()=>{['reportFrom','reportTo','reportClass','reportStudent','reportType'].forEach(id=>$(id).value='');loadReports().catch(e=>toast(e.message))});$('csvBtn').addEventListener('click',async()=>{try{const {blob}=await apiBlob('/api/reports.csv'+reportQuery());downloadBlob(blob,'safe-student-relatorio-movimentacoes.csv')}catch(e){toast(e.message)}});
$('sendMessageBtn').addEventListener('click',async()=>{const text=$('messageText').value.trim();if(!selectedMessagePeer||!text)return toast('Selecione um contato e escreva a mensagem.');setBusy($('sendMessageBtn'),true,'Enviando...');try{await api('/api/messages',{method:'POST',body:JSON.stringify({toUserId:selectedMessagePeer,text})});$('messageText').value='';await loadMessages();await loadDashboard();toast('Mensagem enviada.')}catch(e){toast(e.message)}finally{setBusy($('sendMessageBtn'),false)}});
$('applyAuditBtn').addEventListener('click',()=>loadAudit().catch(e=>toast(e.message)));$('clearAuditBtn').addEventListener('click',()=>{['auditSearch','auditAction','auditUser','auditFrom','auditTo'].forEach(id=>$(id).value='');loadAudit().catch(e=>toast(e.message))});

// Validação acadêmica
$('saveFeedbackBtn').addEventListener('click',async()=>{try{await api('/api/feedback',{method:'POST',body:JSON.stringify({profile:$('feedbackProfile').value,scenario:$('feedbackScenario').value,success:$('feedbackSuccess').value==='SIM',timeSeconds:$('feedbackTime').value,score:Number($('feedbackScore').value),comment:$('feedbackComment').value})});$('feedbackComment').value='';$('feedbackTime').value='';toast('Evidência registrada.');await loadFeedback()}catch(e){toast(e.message)}});$('feedbackCsvBtn').addEventListener('click',async()=>{try{const {blob}=await apiBlob('/api/feedback.csv');downloadBlob(blob,'safe-student-validacao-mvp.csv')}catch(e){toast(e.message)}});

(async()=>{
  showShell(false);
  try{const me=await api('/api/me');currentUser=me.user;await loadDashboard();await goView('dashboard')}catch{showShell(false)}
})();
