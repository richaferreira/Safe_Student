/**
 * Notificações internas filtradas pelo escopo do usuário.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function loadNotifications(){
  if(!students.length)await loadStudents();
  const params=new URLSearchParams();
  if($('notificationReadFilter')?.value==='unread')params.set('unread','1');
  if($('notificationStudentFilter')?.value)params.set('studentId',$('notificationStudentFilter').value);
  const data=await api('/api/notifications'+(params.toString()?`?${params}`:''));
  $('notificationStudentFilter').innerHTML='<option value="">Todos os estudantes</option>'+students.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if(params.get('studentId'))$('notificationStudentFilter').value=params.get('studentId');
  $('notificationsList').innerHTML=data.notifications.map(n=>`<article class="list-card ${n.read?'':'unread'}"><div class="section-title"><div><strong>${escapeHtml(n.title)}</strong><small><button class="student-name-link compact" type="button" data-student-profile="${n.studentId}">${escapeHtml(n.student)}</button> · ${fmt(n.createdAt)}</small></div>${!n.read?`<button class="text-btn" data-read-notification="${n.id}">Marcar como lida</button>`:''}</div><p>${
    escapeHtml(n.message)
  }
  </p></article>`).join('')||'<p class="empty">Nenhuma notificação neste filtro.</p>';
  $('markAllReadBtn').dataset.ids=data.notifications.filter(n=>!n.read).map(n=>n.id).join(',');
}
