/**
 * Conversas entre os perfis autorizados.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function loadMessages(){
  const [data,directory]=await Promise.all([api('/api/messages/conversations'),api('/api/directory')]);
  const conversations=data.conversations||[];
  $('messageTo').innerHTML='<option value="">Escolha um contato</option>'+directory.people.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${roleName(p.role)}</option>`).join('');
  $('conversationList').innerHTML=conversations.map(c=>`<button class="conversation-item ${activeConversationPeer===c.peer.id?'active':''}" data-conversation="${c.peer.id}"><span class="student-avatar sm">${initials(c.peer.name)}</span><span><strong>${escapeHtml(c.peer.name)}</strong><small>${roleName(c.peer.role)} · ${escapeHtml(c.messages.at(-1)?.text||'')}</small></span><time>${fmt(c.lastAt)}</time></button>`).join('')||'<p class="empty">Nenhuma conversa iniciada.</p>';
  if(!activeConversationPeer&&conversations[0])activeConversationPeer=conversations[0].peer.id;
  const active=conversations.find(c=>c.peer.id===activeConversationPeer);
  renderThread(active);
  if(active)$('messageTo').value=active.peer.id;
}
function renderThread(conversation){
  if(!conversation){
    $('threadHeader').innerHTML='<div><h2>Nova conversa</h2><small>Escolha um contato autorizado abaixo.</small></div>';
    $('messagesList').innerHTML='<p class="empty">Nenhuma conversa selecionada.</p>';
    return
  }
  $('threadHeader').innerHTML=`<div class="person-cell"><span class="student-avatar">${initials(conversation.peer.name)}</span><span><h2>${escapeHtml(conversation.peer.name)}</h2><small>${roleName(conversation.peer.role)}</small></span></div>`;
  $('messagesList').innerHTML=conversation.messages.map(m=>`<article class="bubble ${m.ownMessage?'mine':''}"><p>${escapeHtml(m.text)}</p><small>${fmt(m.createdAt)}</small></article>`).join('');
  $('messagesList').scrollTop=$('messagesList').scrollHeight
}
