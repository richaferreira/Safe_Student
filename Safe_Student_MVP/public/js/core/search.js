/**
 * Busca global do portal.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function executeGlobalSearch(){
  const q=$('globalSearch').value.trim();
  if(q.length<2){
    $('globalSearchResults').classList.add('hidden');
    return
  }
  try{
    const data=await api(`/api/search?q=${encodeURIComponent(q)}`);
    const groups=[['Alunos',data.students||[]],['Responsáveis',data.guardians||[]],['Registros',data.records||[]],['Mensagens',data.messages||[]]];
    const items=groups.flatMap(([g,list])=>list.map(x=>({
      group:g,...x
    })));
    $('globalSearchResults').innerHTML=items.length?items.map(x=>`<button class="search-result" ${x.group==='Alunos'?`data-student-profile="${x.id}"`:`data-search-view="${x.view}"`}><small>${x.group}</small><strong>${escapeHtml(x.name||x.title||x.description||'Resultado')}</strong><span>${escapeHtml(x.className||x.email||x.description||'')}</span></button>`).join(''):'<p class="search-empty">Nenhum resultado.</p>';
    $('globalSearchResults').classList.remove('hidden')
  }catch(e){
    toast(e.message)
  }
}
