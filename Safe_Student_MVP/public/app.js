let sessionToken=sessionStorage.getItem('ss_token_V1');
let currentUser=JSON.parse(sessionStorage.getItem('ss_user_V1')||'null');
let dashboard=null, students=[], notifications=[], reports=[], feedbacks=[], attendanceType='ENTRADA';
let schoolTimeZone='America/Sao_Paulo';
let classCatalog=[], guardianCatalog=[], editingStudentId=null, latestInvite=null;
const $=id=>document.getElementById(id);
const qsa=s=>Array.from(document.querySelectorAll(s));
const viewMeta={
  dashboard:['Painel','Visão geral','Movimentações e indicadores da sua unidade.'],
  presence:['Operação','Registrar presença','Registre a entrada ou saída de um estudante.'],
  students:['Cadastros','Alunos e vínculos','Consulte alunos e gerencie os vínculos permitidos.'],
  guardians:['Famílias','Responsáveis e convites','Verifique acessos, convites e vínculos familiares.'],
  notifications:['Comunicação','Notificações','Avisos gerados para sua conta.'],
  reports:['Indicadores','Relatórios','Consulte registros e exporte relatórios de demonstração.'],
  messages:['Relacionamento','Comunicação','Converse com os contatos autorizados.'],
  audit:['Administração','Auditoria','Ações críticas registradas no sistema.'],
  feedback:['Demonstração','Validação acadêmica','Registre avaliações de teste sem dados pessoais.'],
  privacy:['Informações','Privacidade','Controles existentes e limitações da demonstração.']
};
function api(path,opts={}){return fetch(path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{}),...(sessionToken?{Authorization:`Bearer ${sessionToken}`}:{})}}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Falha na operação.');return data;});}
async function apiBlob(path){const r=await fetch(path,{headers:{...(sessionToken?{Authorization:`Bearer ${sessionToken}`}:{})}});if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||'Falha na exportação.')}return {blob:await r.blob(),disposition:r.headers.get('content-disposition')||''}}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function fmt(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:schoolTimeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'}
function roleName(r){return {RESPONSAVEL:'Responsável',PORTARIA:'Portaria',GESTAO:'Gestão escolar',ADMIN:'Administrador'}[r]||r}
function initials(name){return String(name||'SS').split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3200)}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showShell(logged){$('loginView').classList.toggle('hidden',logged);$('appView').classList.toggle('hidden',!logged);$('logoutBtn').classList.toggle('hidden',!logged);$('appTopContext').classList.toggle('hidden',!logged);document.body.classList.toggle('is-authenticated',logged);if(!logged)closeMobileNav()}
function applyRole(){const manager=['GESTAO','ADMIN'].includes(currentUser?.role);const op=['PORTARIA','GESTAO','ADMIN'].includes(currentUser?.role);qsa('.role-manager').forEach(x=>{if(x.classList.contains('panel')||x.classList.contains('view-section')){if(!manager)x.classList.add('hidden');}else x.classList.toggle('hidden',!manager)});qsa('.role-op').forEach(x=>x.classList.toggle('hidden',!op));$('userName').textContent=currentUser?.name||'';$('userRole').textContent=roleName(currentUser?.role);$('avatar').textContent=initials(currentUser?.name);$('headerAvatar').textContent=initials(currentUser?.name);$('headerName').textContent=currentUser?.name||'';$('headerRole').textContent=roleName(currentUser?.role);configureQuickAction();}
function goView(name){if(!viewMeta[name])return;if(name==='guardians'&&!['GESTAO','ADMIN'].includes(currentUser?.role))return;if(name==='presence'&&!['PORTARIA','GESTAO','ADMIN'].includes(currentUser?.role))return;if(name==='audit'&&!['GESTAO','ADMIN'].includes(currentUser?.role))return;qsa('.view-section').forEach(v=>v.classList.add('hidden'));$(`view-${name}`).classList.remove('hidden');qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));const m=viewMeta[name];$('pageEyebrow').textContent=m[0];$('pageTitle').textContent=m[1];$('pageSubtitle').textContent=m[2];if(name==='students')loadStudents().catch(e=>toast(e.message));if(name==='guardians')loadGuardians().catch(e=>toast(e.message));if(name==='reports')loadReports();if(name==='messages')loadMessages();if(name==='audit')loadAudit();if(name==='feedback')loadFeedback();closeMobileNav();}
function dashboardIcon(name){return `<svg class="nav-icon" aria-hidden="true"><use href="#${name}"/></svg>`}
function renderMetrics(){
  const m=dashboard.metrics, guardian=currentUser.role==='RESPONSAVEL';
  // A movement event is not synonymous with classroom attendance or an absence.
  const cards=[
    ['i-users',m.students,guardian?'Meus estudantes':'Estudantes no escopo','Alunos cadastrados e acessíveis','students'],
    ['i-in',m.entradasHoje,'Entradas hoje','Registros efetuados hoje',guardian?'students':'presence'],
    ['i-out',m.saidasHoje,'Saídas hoje','Registros efetuados hoje','reports'],
    ['i-check',m.semSaidaHoje,'Entradas sem saída','Último lançamento de hoje','students'],
    ['i-bell',m.notificacoesNaoLidas,'Avisos não lidos','Notificações da sua conta','notifications'],
  ];
  $('metrics').innerHTML=cards.map(([icon,value,label,context,view],index)=>
    `<button type="button" class="metric-card metric-${index}" data-go="${view}" aria-label="${label}: ${value}. Abrir ${viewMeta[view][1]}"><span class="metric-icon">${dashboardIcon(icon)}</span><span class="metric-content"><span class="metric-label">${label}</span><strong>${value}</strong><span class="metric-context">${context}</span></span><span class="metric-chevron" aria-hidden="true">${dashboardIcon('i-arrow')}</span></button>`
  ).join('');
  $('notifBadge').textContent=m.notificacoesNaoLidas;
  $('notifBadge').classList.toggle('hidden',m.notificacoesNaoLidas===0);
  $('headerNotifCount').textContent=m.notificacoesNaoLidas;
  $('headerNotifCount').classList.toggle('hidden',m.notificacoesNaoLidas===0);
}
function renderChart(){
  const days=dashboard.weeklyMovements||[];
  const highest=Math.max(1,...days.flatMap(day=>[day.entradas,day.saidas]));
  $('activityChart').setAttribute('aria-label','Movimentações nos últimos sete dias: '+days.map(day=>`${day.date}: ${day.entradas} entradas, ${day.saidas} saídas`).join('; '));
  $('activityChart').innerHTML=days.map(day=>{
    const label=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short'}).format(new Date(`${day.date}T12:00:00Z`)).replace('.','');
    return `<div class="chart-day"><div class="chart-value">${day.entradas+day.saidas}</div><div class="chart-bars"><span class="chart-bar entry" style="height:${Math.max(2,day.entradas/highest*100)}%" title="${day.entradas} entradas"></span><span class="chart-bar exit" style="height:${Math.max(2,day.saidas/highest*100)}%" title="${day.saidas} saídas"></span></div><strong>${escapeHtml(label)}</strong><small>${day.date.slice(8,10)}/${day.date.slice(5,7)}</small></div>`;
  }).join('')||'<p class="empty">Ainda não há dados para o gráfico.</p>';
  const any=days.some(day=>day.entradas||day.saidas);
  $('activityChart').classList.toggle('chart-no-data',!any);
  if(!any) $('activityChart').insertAdjacentHTML('beforeend','<p class="chart-empty-note">Nenhuma movimentação registrada neste período.</p>');
}
function renderClasses(){
  const classes=dashboard.classOverview||[];
  $('classOverview').innerHTML=classes.map(c=>{
    const pct=c.students?Math.round(c.entradasSemSaida/c.students*100):0;
    return `<div class="class-row"><div class="class-row-title"><strong>${escapeHtml(c.name)}</strong><span>${c.students} aluno(s)</span></div><div class="class-progress"><div style="width:${pct}%"></div></div><small>${c.entradasSemSaida} entrada(s) sem saída · ${c.saidas} saída(s) · ${c.semRegistro} sem registro</small></div>`;
  }).join('')||'<p class="empty">Nenhuma turma no seu escopo.</p>';
}
function renderDashboard(){
  renderMetrics();renderChart();renderClasses();
  const guardian=currentUser.role==='RESPONSAVEL', gate=currentUser.role==='PORTARIA';
  $('headerSchool').textContent=dashboard.school?.name||'Unidade escolar';
  $('dashboardSchool').textContent=dashboard.school?.name||'Unidade escolar';
  $('dashboardHeadline').textContent=guardian?'Mais perto da rotina de quem você cuida.':gate?'Uma portaria organizada faz a diferença.':'Juntos por uma escola mais presente.';
  $('dashboardDescription').textContent=guardian
    ?'Acompanhe os últimos registros e as mensagens disponíveis para sua família.'
    :gate?'Acesse os lançamentos e registre movimentações com agilidade.'
    :'Consulte movimentações, avisos e indicadores no mesmo ambiente.';
  $('heroDate').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:schoolTimeZone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  $('recentAttendance').innerHTML=dashboard.attendance.slice(0,5).map(r=>
    `<div class="timeline-row"><span class="event-icon ${r.type==='SAIDA'?'exit':''}" aria-hidden="true">${dashboardIcon(r.type==='ENTRADA'?'i-in':'i-out')}</span><div><strong>${escapeHtml(r.student)}</strong><small>${r.type==='ENTRADA'?'Entrada':'Saída'} · Registrado por token</small></div><span class="event-time">${fmt(r.timestamp)}</span></div>`
  ).join('')||'<p class="empty">Nenhuma movimentação registrada no seu escopo.</p>';
  $('recentNotifications').innerHTML=dashboard.notifications.slice(0,3).map(n=>
    `<article class="list-card ${n.read?'':'unread'}"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.student)} · ${fmt(n.createdAt)}</small><p>${escapeHtml(n.message)}</p></article>`
  ).join('')||'<p class="empty">Nenhuma notificação para sua conta.</p>';
  $('recentMessages').innerHTML=(dashboard.recentMessages||[]).slice(0,3).map(m=>
    `<article class="message-preview"><div class="message-avatar" aria-hidden="true">${escapeHtml(initials(m.ownMessage?m.toName:m.fromName))}</div><div><strong>${escapeHtml(m.ownMessage?'Para: '+m.toName:m.fromName)}</strong><small>${fmt(m.createdAt)}</small><p>${escapeHtml(m.text)}</p></div></article>`
  ).join('')||'<p class="empty">Nenhuma mensagem disponível para sua conta.</p>';
  // Tokens are shown only to permitted operation profiles.
  const visible=guardian?[]:dashboard.students.filter(student=>student.token);
  $('studentTokenOptions').innerHTML=visible.map(student=>`<option value="${escapeHtml(student.token)}" label="${escapeHtml(student.name)}"></option>`).join('');
  $('quickTokens').innerHTML=visible.slice(0,6).map(student=>
    `<button type="button" class="token-btn" data-token="${escapeHtml(student.token)}">${escapeHtml(student.name.split(' ')[0])} · ${escapeHtml(student.token)}</button>`
  ).join('');
  qsa('[data-token]').forEach(button=>button.addEventListener('click',()=>{
    $('studentToken').value=button.dataset.token;
    $('deviceToken').textContent=button.dataset.token;
  }));
  $('studentPulse').innerHTML=(dashboard.studentStatuses||[]).slice(0,8).map(student=>{
    const kind=student.lastType==='ENTRADA'?'entered':student.lastType==='SAIDA'?'exited':'';
    const status=student.lastType==='ENTRADA'?'Entrada':student.lastType==='SAIDA'?'Saída':'Sem registro';
    return `<div class="pulse-item"><span class="pulse-avatar" aria-hidden="true">${escapeHtml(initials(student.name))}</span><div class="pulse-copy"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.className)}${student.lastTimestamp?' · '+fmt(student.lastTimestamp):''}</small></div><span class="pulse-status ${kind}">${status}</span></div>`;
  }).join('')||'<p class="empty">Nenhum estudante disponível para este perfil.</p>';
}
async function loadDashboard(){dashboard=await api('/api/dashboard');schoolTimeZone=dashboard.school?.timeZone||schoolTimeZone;$('todayChip').textContent=new Date().toLocaleDateString('pt-BR',{timeZone:schoolTimeZone,weekday:'short',day:'2-digit',month:'short'});showShell(true);applyRole();renderDashboard();}
async function loadStudents(){
  const d=await api('/api/students');students=d.students;
  const term=$('studentSearch').value.trim().toLocaleLowerCase('pt-BR');
  renderStudents(term?students.filter(item=>[item.name,item.enrollment,item.className,item.token].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(term))):students);
  if(['GESTAO','ADMIN'].includes(currentUser.role)){
    const [classes,guards]=await Promise.all([api('/api/classes'),api('/api/guardians')]);
    classCatalog=classes.classes;guardianCatalog=guards.guardians;
    const options=classCatalog.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} - ${escapeHtml(c.shift)}</option>`).join('');
    $('newStudentClass').innerHTML=options;$('editStudentClass').innerHTML=options;
    $('linkStudent').innerHTML=students.filter(s=>s.status==='ATIVO').map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
    const goptions=guardianCatalog.filter(g=>g.status==='ATIVO').map(g=>`<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)} · ${escapeHtml(g.email)}</option>`).join('');
    $('linkGuardian').innerHTML=goptions;$('studentGuardianId').innerHTML=goptions;
  }
}
function renderStudents(list){
  const op=['PORTARIA','GESTAO','ADMIN'].includes(currentUser?.role),manager=['GESTAO','ADMIN'].includes(currentUser?.role);
  if(!list.length){$('studentsTable').innerHTML='<p class="empty">Nenhum aluno encontrado neste perfil.</p>';return;}
  $('studentsTable').innerHTML=`<table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Turma</th>${op?'<th>Token de teste</th>':''}${manager?'<th>Responsáveis</th>':''}<th>Situação</th>${manager?'<th>Ações</th>':''}</tr></thead><tbody>${list.map(s=>`<tr><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.enrollment)}</td><td>${escapeHtml(s.className)}</td>${op?`<td><code>${escapeHtml(s.token||'-')}</code></td>`:''}${manager?`<td>${(s.guardians||[]).map(g=>`${escapeHtml(g.name)}${g.status==='CONVITE_PENDENTE'?' (convite pendente)':''}`).join(', ')||'<span class="form-error">Sem responsável ativo</span>'}</td>`:''}<td><span class="status-pill${s.status!=='ATIVO'?' is-inactive':''}">${escapeHtml(s.status)}</span></td>${manager?`<td><div class="table-actions"><button type="button" class="btn secondary student-action" data-student-edit="${escapeHtml(s.id)}">Editar</button><button type="button" class="btn secondary student-action" data-student-link="${escapeHtml(s.id)}">Vincular responsável</button></div></td>`:''}</tr>`).join('')}</tbody></table>`;
}
function toggleGuardianFields(){const existing=$('guardianMode').value==='existing';$('guardianNewFields').classList.toggle('hidden',existing);$('guardianExistingFields').classList.toggle('hidden',!existing);}
function presentInvitation(result){if($('view-students').classList.contains('hidden'))goView('students');latestInvite=result;
  $('invitationCode').textContent=result.activationCode;
  $('invitationRecipient').textContent=`Destinatário: ${result.invitation.name} (${result.invitation.email}). Válido até ${fmt(result.invitation.expiresAt)}.`;
  $('invitationResult').classList.remove('hidden');$('invitationResult').scrollIntoView({behavior:'smooth',block:'center'});
}
function guardianStatusView(status){return status==='CONVITE_PENDENTE'?{label:'Convite pendente',cls:'is-pending'}:{label:'Ativo',cls:''}}
async function loadGuardians(){
  if(!['GESTAO','ADMIN'].includes(currentUser.role))return;
  const [d,studentData]=await Promise.all([api('/api/guardians'),api('/api/students')]);students=studentData.students;guardianCatalog=d.guardians;
  $('guardiansTable').innerHTML=d.guardians.length?`<table><thead><tr><th>Responsável</th><th>Contato</th><th>Filhos vinculados</th><th>Acesso</th></tr></thead><tbody>${d.guardians.map(g=>{const gs=guardianStatusView(g.status);return `<tr><td><strong>${escapeHtml(g.name)}</strong></td><td>${escapeHtml(g.email)}<br><small>${escapeHtml(g.phone||'Telefone não informado')}${g.cpfMasked?` · CPF ${escapeHtml(g.cpfMasked)}`:''}</small></td><td><div class="inline-students">${(g.studentIds||[]).map(id=>{const student=students.find(s=>s.id===id);return student?`<span class="chip">${escapeHtml(student.name)} <button type="button" title="Remover vínculo" data-unlink-user="${escapeHtml(g.id)}" data-unlink-student="${escapeHtml(id)}">${dashboardIcon('i-close')}</button></span>`:''}).join('')||'Sem vínculo'}</div></td><td><span class="status-pill ${gs.cls}">${gs.label}</span></td></tr>`;}).join('')}</tbody></table>`:'<p class="empty">Nenhum responsável cadastrado.</p>';
  $('invitationsTable').innerHTML=d.invitations.length?`<table><thead><tr><th>Responsável</th><th>E-mail</th><th>Alunos aprovados</th><th>Expiração</th><th>Ação</th></tr></thead><tbody>${d.invitations.map(i=>`<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.email)}</td><td>${i.studentIds.map(id=>escapeHtml(students.find(s=>s.id===id)?.name||'Aluno indisponível')).join(', ')}</td><td>${fmt(i.expiresAt)}</td><td><button type="button" class="btn secondary student-action" data-renew="${escapeHtml(i.id)}">Gerar novo código</button> <button type="button" class="btn secondary student-action" data-revoke="${escapeHtml(i.id)}">Revogar</button></td></tr>`).join('')}</tbody></table>`:'<p class="empty">Nenhum convite pendente.</p>';
}
async function loadNotifications(){dashboard=await api('/api/dashboard');schoolTimeZone=dashboard.school?.timeZone||schoolTimeZone;notifications=dashboard.notifications;$('notificationsList').innerHTML=notifications.map(n=>`<article class="list-card ${n.read?'':'unread'}"><div class="section-title"><div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.student)} • ${fmt(n.createdAt)}</small></div>${!n.read&&n.userId===currentUser.id?`<button class="text-btn mark-read" data-id="${n.id}">Marcar como lida</button>`:''}</div><p>${escapeHtml(n.message)}</p></article>`).join('')||'<p class="empty">Sem notificações.</p>';qsa('.mark-read').forEach(b=>b.addEventListener('click',async()=>{await api(`/api/notifications/${b.dataset.id}`,{method:'PATCH'});toast('Notificação marcada como lida.');await loadNotifications();await loadDashboard();goView('notifications');}));}
function reportQuery(){const query=new URLSearchParams();
  if($('reportFrom').value)query.set('from',$('reportFrom').value);
  if($('reportTo').value)query.set('to',$('reportTo').value);
  if($('reportClass').value)query.set('classId',$('reportClass').value);
  return query.toString()?'?'+query.toString():'';
}
async function loadReports(){
  if(!$('reportClass').options.length || !$('reportClass').dataset.initialized){
    const classes=[...new Map((dashboard?.students||[]).map(s=>[s.classId,[s.classId,s.className]])).values()];
    $('reportClass').innerHTML='<option value="">Todas as turmas do meu escopo</option>'+classes.map(([id,name])=>`<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
    $('reportClass').dataset.initialized='yes';
  }
  const d=await api('/api/reports'+reportQuery());reports=d.rows;
  const totalEnt=reports.reduce((a,r)=>a+r.entradas,0);const totalSai=reports.reduce((a,r)=>a+r.saidas,0);
  $('reportMetrics').innerHTML=[['i-table',reports.length,'alunos no relatório'],['i-in',totalEnt,'entradas registradas'],['i-out',totalSai,'saídas registradas']].map(c=>`<article class="metric-card"><span class="metric-icon">${dashboardIcon(c[0])}</span><span class="metric-content"><strong>${c[1]}</strong><span class="metric-context">${c[2]}</span></span></article>`).join('');
  $('reportDisclaimer').textContent='Contagem de movimentações da portaria. Não representa frequência em sala de aula. A exportação respeita seu perfil.';
  $('reportsTable').innerHTML=reports.length?`<table><thead><tr><th>Aluno</th><th>Turma</th><th>Entradas</th><th>Saídas</th><th>Último registro no período</th></tr></thead><tbody>${reports.map(r=>`<tr><td><b>${escapeHtml(r.name)}</b><br><small>${escapeHtml(r.enrollment)}</small></td><td>${escapeHtml(r.className)}</td><td>${r.entradas}</td><td>${r.saidas}</td><td>${fmt(r.ultimoRegistro)}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">Nenhum aluno corresponde aos filtros e permissões atuais.</p>';
}
async function loadMessages(){const [m,d]=await Promise.all([api('/api/messages'),api('/api/directory')]);$('messagesList').innerHTML=m.messages.map(x=>`<article class="chat-message ${x.fromUserId===currentUser.id?'mine':''}"><b>${escapeHtml(x.fromName)} → ${escapeHtml(x.toName)}</b><small>${fmt(x.createdAt)}</small><p>${escapeHtml(x.text)}</p></article>`).join('')||'<p class="empty">Nenhuma mensagem.</p>';$('messageTo').innerHTML=d.people.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} • ${roleName(p.role)}</option>`).join('')}
async function loadFeedback(){const d=await api('/api/feedback');feedbacks=d.rows;$('feedbackMetrics').innerHTML=[['i-star',d.avg||0,'nota média coletada'],['i-table',d.total||0,'avaliações coletadas'],['i-check',(d.successRate||0)+'%','sucesso nas tarefas'],['i-clock',d.avgTimeSeconds?d.avgTimeSeconds+'s':'-','tempo médio']].map(c=>`<article class="metric-card"><span class="metric-icon">${dashboardIcon(c[0])}</span><span class="metric-content"><strong>${c[1]}</strong><span class="metric-context">${c[2]}</span></span></article>`).join('');$('feedbackDisclaimer').textContent=`${d.disclaimer} Registros ilustrativos na base: ${d.demoSeedCount||0}.`;$('feedbackList').innerHTML=feedbacks.slice(0,12).map(f=>`<article class="list-card"><strong>${escapeHtml(f.profile)} • Nota ${f.score}/5${typeof f.success==='boolean'?` • ${f.success?'Tarefa concluída':'Tarefa não concluída'}`:''}</strong><small>${escapeHtml(f.scenario||'Cenário não informado')} • ${fmt(f.createdAt)}${f.timeSeconds?` • ${f.timeSeconds}s`:''}</small><p>${escapeHtml(f.comment)}</p>${(f.source||'DEMO_SEED')==='DEMO_SEED'?'<span class="demo-evidence">DADO ILUSTRATIVO - não contar como pesquisa de campo</span>':''}</article>`).join('')||'<p class="empty">Sem feedback coletado.</p>'}
async function loadAudit(){if(!['GESTAO','ADMIN'].includes(currentUser.role))return;const d=await api('/api/audit');$('auditTable').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>${d.rows.map(a=>`<tr><td>${fmt(a.createdAt)}</td><td>${escapeHtml(a.userName)}</td><td><code>${escapeHtml(a.action)}</code></td><td>${escapeHtml(a.entity||'-')}</td><td>${escapeHtml(a.details||'-')}</td></tr>`).join('')}</tbody></table>`}
async function login(email,password){const d=await api('/api/login',{method:'POST',body:JSON.stringify({email,password})});sessionToken=d.token;currentUser=d.user;sessionStorage.setItem('ss_token_V1',sessionToken);sessionStorage.setItem('ss_user_V1',JSON.stringify(currentUser));await loadDashboard();goView('dashboard')}
function logoutLocal(){ $('globalSearch').value='';sessionStorage.removeItem('ss_token_V1');sessionStorage.removeItem('ss_user_V1');sessionToken=null;currentUser=null;showShell(false)}
function closeMobileNav(){document.body.classList.remove('mobile-nav-open');$('mobileNavBtn').setAttribute('aria-expanded','false');$('mobileNavBtn').setAttribute('aria-label','Abrir menu')}
$('mobileNavBtn').addEventListener('click',()=>{const expanded=document.body.classList.toggle('mobile-nav-open');$('mobileNavBtn').setAttribute('aria-expanded',String(expanded));$('mobileNavBtn').setAttribute('aria-label',expanded?'Fechar menu':'Abrir menu')});
$('togglePassword').addEventListener('click',()=>{const input=$('password');const show=input.type==='password';input.type=show?'text':'password';$('togglePassword').textContent=show?'Ocultar senha':'Mostrar senha';$('togglePassword').setAttribute('aria-pressed',String(show))});
 $('forgotPasswordBtn').addEventListener('click',()=>{$('loginForm').classList.add('hidden');$('guardianRegisterForm').classList.add('hidden');$('passwordResetForm').classList.remove('hidden');$('resetEmail').value=$('email').value;$('resetEmail').focus()});
 $('backFromResetBtn').addEventListener('click',()=>{$('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden');$('loginError').textContent=''});
 $('requestResetBtn').addEventListener('click',async()=>{const btn=$('requestResetBtn');$('resetError').textContent='';btn.disabled=true;try{const d=await api('/api/password/forgot',{method:'POST',body:JSON.stringify({email:$('resetEmail').value})});$('resetCodeArea').classList.remove('hidden');$('resetDemoCode').textContent=d.demoCode||'Código enviado ao canal institucional cadastrado.';toast('Código temporário gerado.')}catch(error){$('resetError').textContent=error.message}finally{btn.disabled=false}});
 $('passwordResetForm').addEventListener('submit',async event=>{event.preventDefault();const btn=$('resetPasswordBtn');$('resetError').textContent='';btn.disabled=true;try{await api('/api/password/reset',{method:'POST',body:JSON.stringify({email:$('resetEmail').value,code:$('resetCode').value,password:$('resetPassword').value,confirmPassword:$('resetConfirm').value})});$('email').value=$('resetEmail').value;$('passwordResetForm').reset();$('resetCodeArea').classList.add('hidden');$('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden');toast('Senha redefinida. Entre com a nova senha.')}catch(error){$('resetError').textContent=error.message}finally{btn.disabled=false}});
function executeGlobalSearch(){$('studentSearch').value=$('globalSearch').value;goView('students');$('studentSearch').dispatchEvent(new Event('input'));$('studentSearch').focus()}
$('globalSearch').addEventListener('keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();executeGlobalSearch()});
$('globalSearchBtn').addEventListener('click',executeGlobalSearch);
$('headerNotifications').addEventListener('click',async()=>{try{await loadNotifications();goView('notifications')}catch(error){toast(error.message)}});
qsa('[data-login]').forEach(b=>b.addEventListener('click',()=>{$('email').value=b.dataset.login;$('password').value='demo123'}));
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('loginSubmitBtn');$('loginError').textContent='';btn.disabled=true;btn.classList.add('is-loading');btn.setAttribute('aria-busy','true');btn.innerHTML='<span class="spinner" aria-hidden="true"></span> Entrando no portal';try{await login($('email').value,$('password').value)}catch(err){$('loginError').textContent=err instanceof TypeError?'Não foi possível conectar ao portal. Verifique sua conexão e tente novamente.':err.message}finally{btn.disabled=false;btn.classList.remove('is-loading');btn.removeAttribute('aria-busy');btn.innerHTML='Entrar no portal <svg class="nav-icon"><use href="#i-arrow"/></svg>'}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'})}catch{}logoutLocal()});
function syncThemeIcon(){const use=$('themeBtn').querySelector('use');use.setAttribute('href',document.documentElement.dataset.theme==='dark'?'#i-moon':'#i-sun')}
$('themeBtn').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('ss_theme',next);syncThemeIcon()});document.documentElement.dataset.theme=localStorage.getItem('ss_theme')||'light';syncThemeIcon();
qsa('.nav-item').forEach(b=>b.addEventListener('click',async()=>{if(b.dataset.view==='notifications')await loadNotifications();goView(b.dataset.view)}));document.addEventListener('click',event=>{const button=event.target.closest('[data-go]');if(button){const target=button.dataset.go;if(target==='notifications'){loadNotifications().then(()=>goView(target)).catch(error=>toast(error.message))}else if(target==='students-new'){goView('students');openStudentForm()}else goView(target)}});
qsa('.seg').forEach(b=>b.addEventListener('click',()=>{attendanceType=b.dataset.type;qsa('.seg').forEach(x=>x.classList.toggle('active',x===b))}));
$('studentToken').addEventListener('input',()=>{$('deviceToken').textContent=$('studentToken').value.trim().toUpperCase()||'TOKEN'});
$('registerBtn').addEventListener('click',async()=>{const fb=$('registerFeedback');fb.textContent='Processando...';fb.className='feedback';try{const d=await api('/api/attendance',{method:'POST',body:JSON.stringify({token:$('studentToken').value,type:attendanceType})});fb.textContent=`${d.student.name}: ${d.record.type.toLowerCase()} registrada. ${d.notified} responsável(is) notificado(s).`;fb.classList.add('ok');toast('Presença registrada com sucesso.');$('studentToken').value='';await loadDashboard();goView('presence')}catch(err){fb.textContent=err.message;fb.classList.add('err')}});
$('studentSearch').addEventListener('input',()=>{const t=$('studentSearch').value.toLowerCase();renderStudents(students.filter(s=>[s.name,s.enrollment,s.className,s.token].some(v=>String(v).toLowerCase().includes(t))))});
$('guardianMode').addEventListener('change',toggleGuardianFields);
function openStudentForm(){$('studentFormPanel').classList.remove('hidden');$('invitationResult').classList.add('hidden');$('editStudentPanel').classList.add('hidden');$('studentFormPanel').scrollIntoView({behavior:'smooth',block:'start'});$('newStudentName').focus()}
function configureQuickAction(){
  const manager=['GESTAO','ADMIN'].includes(currentUser?.role);
  const go=manager?'students-new':'presence';
  const primaryLabel=manager?'+ Cadastrar aluno':'+ Novo registro';
  const heroLabel=manager?'Cadastrar aluno':'Novo registro';
  const primary=$('primaryActionBtn');if(primary){primary.textContent=primaryLabel;primary.dataset.go=go;}
  const hero=$('heroActionBtn');if(hero){hero.querySelector('span').textContent=heroLabel;hero.dataset.go=go;}
}
$('newStudentBtn').addEventListener('click',openStudentForm);
$('cancelStudentBtn').addEventListener('click',()=>{$('studentFormPanel').classList.add('hidden')});
$('saveStudentBtn').addEventListener('click',async()=>{
  const button=$('saveStudentBtn');button.disabled=true;
  try{
    const useExisting=$('guardianMode').value==='existing';
    const payload={name:$('newStudentName').value,enrollment:$('newStudentEnrollment').value,classId:$('newStudentClass').value,
      ...(useExisting?{guardianId:$('studentGuardianId').value}:{guardian:{name:$('newGuardianName').value,email:$('newGuardianEmail').value,phone:$('newGuardianPhone').value,relationship:$('newGuardianRelation').value,cpf:$('newGuardianCpf').value}})};
    const response=await api('/api/students',{method:'POST',body:JSON.stringify(payload)});
    $('studentFormPanel').classList.add('hidden');
    ['newStudentName','newStudentEnrollment','newGuardianName','newGuardianEmail','newGuardianPhone','newGuardianCpf'].forEach(id=>$(id).value='');
    await Promise.all([loadStudents(),loadDashboard()]);
    toast(response.guardianLinked?'Aluno cadastrado e vinculado ao responsável.':'Aluno cadastrado. Entregue o convite de ativação ao responsável.');
    if(response.invitation)presentInvitation(response.invitation);
  }catch(err){toast(err.message)}finally{button.disabled=false}
});
$('linkMode').addEventListener('change',()=>{const isNew=$('linkMode').value==='new';$('linkExistingFields').classList.toggle('hidden',isNew);$('linkNewFields').classList.toggle('hidden',!isNew)});
$('cancelLinkBtn').addEventListener('click',()=>$('linkPanel').classList.add('hidden'));
$('saveLinkBtn').addEventListener('click',async()=>{const button=$('saveLinkBtn');button.disabled=true;try{
  if($('linkMode').value==='existing'){
    await api('/api/links',{method:'POST',body:JSON.stringify({studentId:$('linkStudent').value,guardianId:$('linkGuardian').value})});
    toast('Vínculo autorizado. O aluno aparecerá no painel do responsável.');
  }else{
    const result=await api('/api/guardians/invitations',{method:'POST',body:JSON.stringify({studentId:$('linkStudent').value,guardian:{name:$('linkGuardianName').value,email:$('linkGuardianEmail').value,phone:$('linkGuardianPhone').value,relationship:$('linkGuardianRelation').value,cpf:$('linkGuardianCpf').value}})});
    presentInvitation(result);toast('Convite adicional gerado para o estudante.');
  }
  $('linkPanel').classList.add('hidden');await loadStudents();await loadDashboard();
}catch(err){toast(err.message)}finally{button.disabled=false}});
$('cancelEditStudentBtn').addEventListener('click',()=>{$('editStudentPanel').classList.add('hidden');editingStudentId=null});
$('saveEditStudentBtn').addEventListener('click',async()=>{
  if(!editingStudentId)return;const btn=$('saveEditStudentBtn');btn.disabled=true;
  try{await api(`/api/students/${encodeURIComponent(editingStudentId)}`,{method:'PATCH',body:JSON.stringify({name:$('editStudentName').value,enrollment:$('editStudentEnrollment').value,classId:$('editStudentClass').value,status:$('editStudentStatus').value})});
    $('editStudentPanel').classList.add('hidden');editingStudentId=null;await loadStudents();await loadDashboard();toast('Cadastro atualizado.');
  }catch(err){toast(err.message)}finally{btn.disabled=false}
});
document.addEventListener('click',async event=>{
  const edit=event.target.closest('[data-student-edit]');if(edit){
    const student=students.find(s=>s.id===edit.dataset.studentEdit);if(!student)return;
    editingStudentId=student.id;$('editStudentName').value=student.name;$('editStudentEnrollment').value=student.enrollment;$('editStudentClass').value=student.classId;$('editStudentStatus').value=student.status;
    $('editStudentPanel').classList.remove('hidden');$('studentFormPanel').classList.add('hidden');$('editStudentPanel').scrollIntoView({behavior:'smooth'});return;
  }
  const link=event.target.closest('[data-student-link]');if(link){$('linkStudent').value=link.dataset.studentLink;$('linkPanel').classList.remove('hidden');$('linkPanel').scrollIntoView({behavior:'smooth'});return;}
  const unlink=event.target.closest('[data-unlink-user]');if(unlink){
    if(!confirm('Remover o acesso deste responsável a este estudante?'))return;
    try{await api('/api/links',{method:'DELETE',body:JSON.stringify({guardianId:unlink.dataset.unlinkUser,studentId:unlink.dataset.unlinkStudent})});await loadStudents();await loadGuardians();toast('Vínculo removido.')}catch(e){toast(e.message)}return;
  }
  const revoke=event.target.closest('[data-revoke]');if(revoke){
    if(!confirm('Revogar este convite? O responsável não poderá usá-lo.'))return;
    try{await api(`/api/guardians/invitations/${encodeURIComponent(revoke.dataset.revoke)}`,{method:'DELETE'});await loadStudents();await loadGuardians();toast('Convite revogado.')}catch(e){toast(e.message)}return;
  }
  const renew=event.target.closest('[data-renew]');if(renew){
    if(!confirm('Gerar outro código? O código anterior deixará de funcionar.'))return;
    try{const result=await api(`/api/guardians/invitations/${encodeURIComponent(renew.dataset.renew)}/renew`,{method:'POST'});presentInvitation(result);await loadGuardians();toast('Novo convite emitido.')}catch(e){toast(e.message)}
  }
});
$('refreshGuardiansBtn').addEventListener('click',async()=>{try{await loadStudents();await loadGuardians();toast('Dados atualizados.')}catch(e){toast(e.message)}});
$('copyInvitationBtn').addEventListener('click',async()=>{if(!latestInvite)return;const message=`Safe Student - Convite para ativação\nE-mail: ${latestInvite.invitation.email}\nCódigo: ${latestInvite.activationCode}\nAcesse o portal da escola e escolha "Ativar sua conta". Não compartilhe o código com terceiros.`;
  try{await navigator.clipboard.writeText(message);toast('Instruções copiadas.')}catch{toast('Não foi possível copiar automaticamente. Selecione o código na tela.')}
});
$('showRegisterBtn').addEventListener('click',()=>{$('loginForm').classList.add('hidden');$('guardianRegisterForm').classList.remove('hidden');$('regEmail').focus()});
$('backLoginBtn').addEventListener('click',()=>{$('guardianRegisterForm').classList.add('hidden');$('loginForm').classList.remove('hidden')});
$('guardianRegisterForm').addEventListener('submit',async event=>{event.preventDefault();const btn=$('registerGuardianBtn');btn.disabled=true;$('registerError').textContent='';
  try{const response=await api('/api/guardian/register',{method:'POST',body:JSON.stringify({email:$('regEmail').value,code:$('regCode').value,password:$('regPassword').value,confirmPassword:$('regConfirm').value,cpf:$('regCpf').value})});
    sessionToken=response.token;currentUser=response.user;sessionStorage.setItem('ss_token_V1',sessionToken);sessionStorage.setItem('ss_user_V1',JSON.stringify(currentUser));
    $('guardianRegisterForm').reset();$('guardianRegisterForm').classList.add('hidden');$('loginForm').classList.remove('hidden');await loadDashboard();goView('students');toast('Conta ativada! Seus filhos já estão vinculados.');
  }catch(e){$('registerError').textContent=e.message}finally{btn.disabled=false}
});
$('saveFeedbackBtn').addEventListener('click',async()=>{try{await api('/api/feedback',{method:'POST',body:JSON.stringify({profile:$('feedbackProfile').value,scenario:$('feedbackScenario').value,success:$('feedbackSuccess').value==='SIM',timeSeconds:$('feedbackTime').value,score:Number($('feedbackScore').value),comment:$('feedbackComment').value})});$('feedbackComment').value='';$('feedbackTime').value='';toast('Evidência de validação registrada.');await loadFeedback()}catch(err){toast(err.message)}});
$('sendMessageBtn').addEventListener('click',async()=>{try{await api('/api/messages',{method:'POST',body:JSON.stringify({toUserId:$('messageTo').value,text:$('messageText').value})});$('messageText').value='';toast('Mensagem enviada.');await loadMessages()}catch(err){toast(err.message)}});
$('applyReportBtn').addEventListener('click',()=>loadReports().catch(e=>toast(e.message)));
$('clearReportBtn').addEventListener('click',()=>{$('reportFrom').value='';$('reportTo').value='';$('reportClass').value='';loadReports().catch(e=>toast(e.message))});
$('csvBtn').addEventListener('click',async()=>{try{const {blob}=await apiBlob('/api/reports.csv'+reportQuery());downloadBlob(blob,'safe-student-relatorio-demo.csv')}catch(err){toast(err.message)}});
$('feedbackCsvBtn').addEventListener('click',async()=>{try{const {blob}=await apiBlob('/api/feedback.csv');downloadBlob(blob,'safe-student-validacao-mvp.csv')}catch(err){toast(err.message)}});

(async()=>{if(sessionToken&&currentUser){try{await loadDashboard();goView('dashboard')}catch{logoutLocal()}}else showShell(false)})();
