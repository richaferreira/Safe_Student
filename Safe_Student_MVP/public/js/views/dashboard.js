/**
 * Carregamento e renderização do painel principal.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
function renderMetrics(){
  const m=dashboard.metrics||{
  };
  const cards=currentUser.role==='RESPONSAVEL'? [['i-users',m.students,'Meus estudantes','Alunos vinculados','students'],['i-in',m.dentroHoje??m.semSaidaHoje,'Com entrada hoje','Último evento foi entrada','students'],['i-out',m.foraHoje??m.saidasHoje,'Com saída hoje','Último evento foi saída','reports'],['i-bell',m.notificacoesNaoLidas,'Não lidas','Avisos da sua conta','notifications']]: [['i-users',m.students,'Alunos no escopo','Cadastros visíveis','students'],['i-in',m.dentroHoje??m.semSaidaHoje,'Entrada como último evento','Movimentação operacional','presence'],['i-out',m.foraHoje??0,'Saída como último evento','Movimentação operacional','reports'],['i-clock',m.semRegistroHoje??0,'Sem registro hoje','Não significa ausência','students'],['i-bell',m.notificacoesNaoLidas,'Avisos não lidos','Da sua conta','notifications']];
  $('metrics').innerHTML=cards.map(([ic,val,label,desc,view])=>`<button class="metric-card" data-go="${view}"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><span class="metric-label">${label}</span><strong>${val??0}</strong><span class="metric-context">${desc}</span></span></button>`).join('');
  const unread=m.notificacoesNaoLidas||0;
  $('notifBadge').textContent=unread;
  $('notifBadge').classList.toggle('hidden',!unread);
  $('headerNotifCount').textContent=unread;
  $('headerNotifCount').classList.toggle('hidden',!unread);
}
function renderQuickActions(){
  const list=currentUser.role==='RESPONSAVEL'? [['i-users','Meus filhos','Ver situação e histórico','students'],['i-bell','Notificações','Acompanhar entradas e saídas','notifications'],['i-message','Falar com a escola','Abrir conversas','messages'],['i-chart','Histórico','Filtrar movimentações','reports']]: currentUser.role==='PORTARIA'? [['i-scan','Operar portaria','Consultar token e registrar','presence'],['i-users','Localizar aluno','Consultar dados autorizados','students'],['i-chart','Histórico','Revisar movimentações','reports'],['i-message','Comunicação','Falar com a gestão','messages']]: [['i-users','Nova matrícula','Aluno + responsáveis juntos','students-new'],['i-users','Central de responsáveis','Revisar contas e convites','guardians'],['i-scan','Operar portaria','Registrar movimentação','presence'],['i-chart','Relatórios','Filtrar e exportar','reports'],['i-shield','Auditoria','Rastrear operações','audit']];
  $('quickActions').innerHTML=list.map(([ic,title,desc,view])=>`<button class="quick-action" data-go="${view}"><span class="quick-action-icon">${icon(ic)}</span><span><strong>${title}</strong><small>${desc}</small></span><span>${icon('i-arrow')}</span></button>`).join('');
}
function renderAttention(){
  const list=dashboard.attention||[];
  $('attentionCount').textContent=list.filter(x=>x.type!=='ok').reduce((a,b)=>a+(b.count||0),0);
  $('attentionList').innerHTML=list.map(item=>`<article class="attention-item ${item.type}"><span class="attention-icon">${icon(item.type==='ok'?'i-check':item.type==='warning'?'i-clock':'i-bell')}</span><span class="attention-copy"><strong>${escapeHtml(item.label)} ${item.count?`<b>${
    item.count
  }
  </b>`:''}</strong><small>${
    escapeHtml(item.description)
  }
  </small></span><button class="text-btn" data-go="${item.view}">${
    escapeHtml(item.action)
  }
  ${
    icon('i-arrow')
  }
  </button></article>`).join('')}
function renderChart(){const days=dashboard.weeklyMovements||[];const max=Math.max(1,...days.flatMap(x=>[x.entradas,x.saidas]));$('activityChart').innerHTML=days.map(day=>{const label=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short'}).format(new Date(day.date+'T12:00:00Z')).replace('.','');return `<div class="chart-day"><div class="chart-value">${
    day.entradas+day.saidas
  }
  </div><div class="chart-bars"><span class="chart-bar entry" style="height:${Math.max(3,day.entradas/max*100)
}
%"></span><span class="chart-bar exit" style="height:${
  Math.max(3,day.saidas/max*100)
}
%"></span></div><strong>${escapeHtml(label)}</strong></div>`}).join('');const total=days.reduce((sum,d)=>sum+d.entradas+d.saidas,0);$('trendSummary').innerHTML=`<strong>${total}</strong><span>movimentações nos últimos 7 dias</span>`}
function renderClasses(){const rows=dashboard.classOperational||dashboard.classOverview||[];$('classOverview').innerHTML=rows.map(row=>`<article class="class-row"><div><strong>${escapeHtml(row.name)}</strong><small>${row.students} alunos</small></div><div class="class-statuses"><span class="inside">${row.entradasSemSaida??row.entradas??0} entrada</span><span class="outside">${row.saidas??0} saída</span><span>${row.semRegistro??0} sem registro</span></div></article>`).join('')||'<p class="empty">Sem turmas no escopo.</p>'}
function renderDashboard(){
  const school=dashboard.school||{};$('headerSchool').textContent=school.name||'Unidade escolar';$('dashboardSchool').textContent=school.name||'Unidade escolar';
  const today=new Date().toLocaleDateString('pt-BR',{timeZone:schoolTimeZone,weekday:'long',day:'2-digit',month:'long'});$('heroDate').textContent=today;$('todayChip').textContent=today;
  const first=String(currentUser.name||'').split(' ')[0];$('dashboardHeadline').textContent=currentUser.role==='RESPONSAVEL'?`Olá, ${first}. Acompanhe seus filhos.`:currentUser.role==='PORTARIA'?`Olá, ${first}. Portaria pronta para operar.`:`Olá, ${first}. Acompanhe a operação da escola.`;
  $('dashboardDescription').textContent=currentUser.role==='RESPONSAVEL'?'Veja os últimos registros, notificações e mensagens vinculados aos seus estudantes.':'Indicadores de movimentação, pendências e ações dentro do seu perfil.';
  renderMetrics();renderQuickActions();renderAttention();renderChart();renderClasses();
  $('dashboardTimeline').innerHTML=(dashboard.timeline||[]).map(item=>`<button class="timeline-row" ${item.studentId?`data-student-profile="${
  item.studentId
}
"`:`data-go="${
  item.view
}
"`}><span class="event-icon">${icon(item.type==='entrada'?'i-in':item.type==='saida'?'i-out':item.type==='mensagem'?'i-message':'i-bell')}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><span class="event-time">${fmt(item.createdAt)}</span></button>`).join('')||'<p class="empty">Nenhum acontecimento recente.</p>';
  $('recentMessages').innerHTML=(dashboard.recentMessages||[]).map(m=>`<article class="mini-card"><strong>${m.ownMessage?'Para '+escapeHtml(m.toName):'De '+escapeHtml(m.fromName)}</strong><p>${escapeHtml(m.text)}</p><small>${fmt(m.createdAt)}</small></article>`).join('')||'<p class="empty">Nenhuma mensagem recente.</p>';
  $('recentNotifications').innerHTML=(dashboard.notifications||[]).slice(0,4).map(n=>`<article class="mini-card ${
  n.read?'':'unread'
}
"><strong>${escapeHtml(n.title)}</strong><p>${n.studentId?`<button class="student-name-link compact" type="button" data-student-profile="${
  n.studentId
}
">${escapeHtml(n.student||'')}</button>`:escapeHtml(n.student||'')}</p><small>${fmt(n.createdAt)}</small></article>`).join('')||'<p class="empty">Sem notificações.</p>';
  $('studentPulse').innerHTML=(dashboard.studentStatuses||[]).map(s=>{const state=s.lastType==='ENTRADA'?'DENTRO*':s.lastType==='SAIDA'?'FORA*':'SEM REGISTRO';return `<button class="student-pulse-card" data-student-profile="${
  s.id
}
"><span class="student-avatar">${initials(s.name)}</span><span><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.className)}</small></span><span class="status-badge ${
  s.lastType==='ENTRADA'?'inside':s.lastType==='SAIDA'?'outside':'neutral'
}
">${state}</span><small>${s.lastTimestamp?fmt(s.lastTimestamp):'Nenhum evento hoje'}</small></button>`}).join('')||'<p class="empty">Nenhum aluno no escopo.</p>';
}
async function loadDashboard(){dashboard=await api('/api/dashboard');schoolTimeZone=dashboard.school?.timeZone||schoolTimeZone;showShell(true);applyRole();renderDashboard()}
