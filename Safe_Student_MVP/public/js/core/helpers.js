/**
 * Funções pequenas de interface, formatação e armazenamento local.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
function escapeHtml(value){
  return String(value??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }
  [c]))
}
function initials(name){
  return String(name||'SS').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
}
function roleName(role){
  return {
    RESPONSAVEL:'Responsável',PORTARIA:'Portaria',GESTAO:'Gestão escolar',ADMIN:'Administrador'
  }
  [role]||role
}
function fmt(value){
  return value?new Intl.DateTimeFormat('pt-BR',{
    timeZone:schoolTimeZone,dateStyle:'short',timeStyle:'short'
  }).format(new Date(value)):'—'
}
function icon(name){
  return `<svg class="nav-icon" aria-hidden="true"><use href="#${name}"/></svg>`
}
function toast(message){
  const el=$('toast');
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>el.classList.remove('show'),3200)
}
function safeStoreGet(key){
  try{
    return localStorage.getItem(key)
  }catch{
    return null
  }
}
function safeStoreSet(key,value){
  try{
    localStorage.setItem(key,value)
  }catch{
  }
}
function safeStoreRemove(key){
  try{
    localStorage.removeItem(key)
  }catch{
  }
}
