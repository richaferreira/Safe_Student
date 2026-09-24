/**
 * Perfil individual do aluno e histórico organizado.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
function studentHistoryQuery(){
  const p=new URLSearchParams();
  [['from','studentHistoryFrom'],['to','studentHistoryTo'],['type','studentHistoryType'],['q','studentHistoryQuery']].forEach(([key,id])=>{
    const value=$(id)?.value;if(value)p.set(key,value)
  });
  return p.toString()?`?${p}`:''
}
function profileStateLabel(state){
  return state==='DENTRO'?['DENTRO*','inside']:state==='FORA'?['FORA*','outside']:['SEM REGISTRO','neutral']
}
function groupTimelineByDate(items){
  const groups=new Map();
  items.forEach(item=>{
    const key=new Intl.DateTimeFormat('pt-BR',{
      timeZone:schoolTimeZone,dateStyle:'long'
    }).format(new Date(item.createdAt));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)
  });
  return [...groups.entries()]
}
function timelineIcon(item){
  if(item.category==='MOVIMENTACAO')return item.type==='ENTRADA'?'i-in':'i-out';
  if(item.category==='NOTIFICACAO')return'i-bell';
  return'i-shield'
}
// Monta o perfil conforme as permissões recebidas do backend.
function renderStudentProfile(){
  const d=studentProfileData;
  if(!d)return;
  const student=d.student;
  const [opLabel,opClass]=profileStateLabel(d.operational?.state);
  $('studentProfileAvatar').textContent=initials(student.name);
  $('studentProfileName').textContent=student.name;
  $('studentProfileEnrollment').textContent=student.enrollment;
  $('studentProfileClass').textContent=student.className;
  $('studentProfileAcademicStatus').textContent=student.status;
  $('studentProfileAcademicStatus').className=`status-badge ${student.status==='ATIVO'?'inside':'neutral'}`;
  $('studentProfileOperational').textContent=opLabel;
  $('studentProfileOperational').className=`status-badge ${opClass}`;
  $('studentProfileLastMovement').textContent=d.metrics.allTimeLastMovement?`Último registro: ${fmt(d.metrics.allTimeLastMovement)}`:'Nenhuma movimentação registrada';
  $('studentProfileDisclaimer').textContent=d.disclaimer;
  $('studentProfileScope').textContent=currentUser.role==='RESPONSAVEL'?'Histórico dos seus filhos':currentUser.role==='PORTARIA'?'Histórico operacional autorizado':'Visão administrativa e operacional';
  $('studentProfileOperate').classList.toggle('hidden',!d.permissions.canOperate||student.status!=='ATIVO'||!student.token);
  $('studentProfileOperate').dataset.token=student.token||'';
  $('studentProfileEdit').classList.toggle('hidden',!d.permissions.canManage);
  $('studentProfileEdit').dataset.editStudent=student.id;
  const metrics=[['i-table',d.metrics.movements,'movimentações no filtro'],['i-in',d.metrics.entradas,'entradas'],['i-out',d.metrics.saidas,'saídas'],['i-clock',d.metrics.allTimeMovements,'eventos no histórico total']];
  if(d.permissions.canSeeOwnNotifications)metrics.push(['i-bell',d.metrics.unreadNotifications,'notificações não lidas']);
  $('studentProfileMetrics').innerHTML=metrics.map(([ic,val,label])=>`<article class="metric-card"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><strong>${val??0}</strong><span class="metric-context">${label}</span></span></article>`).join('');
  $('studentProfileEventCount').textContent=`${d.timeline.length} evento(s)`;
  const grouped=groupTimelineByDate(d.timeline);
  $('studentProfileTimeline').innerHTML=grouped.length?grouped.map(([date,items])=>`<section class="history-day"><h3>${escapeHtml(date)}</h3><div>${items.map(item=>`<article class="history-event ${item.category.toLowerCase()}"><span class="event-icon ${item.type==='SAIDA'?'exit':''}">${
    icon(timelineIcon(item))
  }
  </span><div><div class="history-event-head"><strong>${escapeHtml(item.title)}</strong><time>${
    fmt(item.createdAt)
  }
  </time></div><p>${
    escapeHtml(item.description||'')
  }
  </p><small>${item.category==='ADMINISTRATIVO'&&item.userName?`Por ${escapeHtml(item.userName)}`:item.category==='NOTIFICACAO'?(item.read?'Notificação lida':'Notificação não lida'):escapeHtml(item.method||'')}</small></div></article>`).join('')}</div></section>`).join(''):'<p class="empty">Nenhum evento encontrado com estes filtros.</p>';
  $('studentProfileMovements').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Movimento</th><th>Método</th><th>Registrado por</th></tr></thead><tbody>${d.movements.map(row=>`<tr><td>${
    fmt(row.timestamp)
  }
  </td><td><span class="movement-badge ${row.type==='ENTRADA'?'entry':'exit'}">${row.type}</span></td><td>${escapeHtml(row.method||'—')}</td><td>${
    escapeHtml(row.registeredByName||'Sistema')
  }
  <small class="table-sub">${
    row.registeredByRole?roleName(row.registeredByRole):''
  }
  </small></td></tr>`).join('')}</tbody></table>${!d.movements.length?'<p class="empty">Nenhuma movimentação neste filtro.</p>':''}`;
  $('studentProfileFamily').innerHTML=d.permissions.canSeeFamilyContacts?(d.guardians.map(g=>`<article class="profile-family-card"><div class="guardian-card-head"><span class="student-avatar sm ${g.status==='PENDENTE'?'pending':''}">${initials(g.name)}</span><div><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.type==='CONVITE'?(g.relationship||'Responsável convidado'):'Responsável autorizado')}</span></div><span class="status-badge ${g.status==='ATIVO'?'inside':'neutral'}">${escapeHtml(g.status)}</span></div><dl><div><dt>E-mail</dt><dd>${escapeHtml(g.email||'—')}</dd></div><div><dt>Telefone</dt><dd>${escapeHtml(g.phone||'—')}</dd></div>${g.expiresAt?`<div><dt>Convite expira</dt><dd>${fmt(g.expiresAt)}</dd></div>`:''}</dl></article>`).join('')||'<p class="empty">Nenhum responsável ou convite associado.</p>'):'<p class="empty">Contatos familiares não são exibidos para este perfil.</p>';
  $('studentProfileAdministrative').innerHTML=d.permissions.canSeeAdministrativeHistory?`<table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>${d.administrative.map(row=>`<tr><td>${fmt(row.createdAt)}</td><td>${escapeHtml(row.userName)}</td><td><code>${escapeHtml(row.action)}</code></td><td>${escapeHtml(row.details||'—')}</td></tr>`).join('')}</tbody></table>${!d.administrative.length?'<p class="empty">Sem eventos administrativos neste filtro.</p>':''}`:'';
  $('studentProfileNotifications').innerHTML=d.permissions.canSeeOwnNotifications?(d.notifications.map(n=>`<article class="list-card ${n.read?'':'unread'}"><div class="section-title"><div><strong>${escapeHtml(n.title)}</strong><small>${
    fmt(n.createdAt)
  }
  </small></div>${
    !n.read?`<button class="text-btn" data-read-notification="${n.id}">Marcar como lida</button>`:''
  }
  </div><p>${escapeHtml(n.message)}</p></article>`).join('')||'<p class="empty">Nenhuma notificação deste aluno no filtro.</p>'):'';
  qsa('.profile-notifications-tab').forEach(el=>el.classList.toggle('hidden',!d.permissions.canSeeOwnNotifications));renderStudentProfileTab();
}
function renderStudentProfileTab(){const allowed=new Set(['timeline','movements']);if(studentProfileData?.permissions.canSeeFamilyContacts)allowed.add('family');if(studentProfileData?.permissions.canSeeAdministrativeHistory)allowed.add('administrative');if(studentProfileData?.permissions.canSeeOwnNotifications)allowed.add('notifications');if(!allowed.has(studentProfileTab))studentProfileTab='timeline';qsa('.profile-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.profileTab===studentProfileTab));[['timeline','studentProfileTimeline'],['movements','studentProfileMovements'],['family','studentProfileFamily'],['administrative','studentProfileAdministrative'],['notifications','studentProfileNotifications']].forEach(([tab,id])=>$(id).classList.toggle('hidden',tab!==studentProfileTab))}
// Os filtros do histórico são enviados ao servidor para manter a regra de escopo centralizada.
async function loadStudentProfile(){if(!activeStudentProfileId)return;studentProfileData=await api(`/api/students/${encodeURIComponent(activeStudentProfileId)}/profile${studentHistoryQuery()}`);renderStudentProfile()}
async function openStudentProfile(studentId){if(!studentId)return;studentProfileReturn={view:currentView==='student-profile'?'students':currentView,scrollY:window.scrollY};activeStudentProfileId=studentId;studentProfileTab='timeline';['studentHistoryFrom','studentHistoryTo','studentHistoryType','studentHistoryQuery'].forEach(id=>{if($(id))$(id).value=''});await goView('student-profile');window.scrollTo({top:0,behavior:'smooth'})}
async function closeStudentProfile(){const target=studentProfileReturn.view&&studentProfileReturn.view!=='student-profile'?studentProfileReturn.view:'students';await goView(target);requestAnimationFrame(()=>window.scrollTo({top:studentProfileReturn.scrollY||0,behavior:'auto'}))}
