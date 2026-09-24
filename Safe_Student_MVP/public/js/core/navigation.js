/**
 * Controle do layout autenticado, permissões visuais e navegação entre telas.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
function showShell(logged){
  $('loginView').classList.toggle('hidden',logged);
  $('appView').classList.toggle('hidden',!logged);
  $('logoutBtn').classList.toggle('hidden',!logged);
  $('appTopContext').classList.toggle('hidden',!logged);
  document.body.classList.toggle('is-authenticated',logged);
  if(!logged)closeMobileNav()
}
function closeMobileNav(){
  document.body.classList.remove('mobile-nav-open');
  $('mobileNavBtn')?.setAttribute('aria-expanded','false')
}
function applyRole(){
  const manager=isManager(),operator=isOperator();
  qsa('.role-manager').forEach(el=>el.classList.toggle('hidden',!manager));
  qsa('.role-op').forEach(el=>el.classList.toggle('hidden',!operator));
  $('userName').textContent=currentUser?.name||'';
  $('userRole').textContent=roleName(currentUser?.role);
  $('avatar').textContent=initials(currentUser?.name);
  $('headerAvatar').textContent=initials(currentUser?.name);
  $('headerName').textContent=currentUser?.name||'';
  $('headerRole').textContent=roleName(currentUser?.role);
}
async function goView(name){
  if(!viewMeta[name]) return;
  if(name==='guardians'&&!isManager())return;
  if(name==='presence'&&!isOperator())return;
  if(name==='audit'&&!isManager())return;
  currentView=name;
  qsa('.view-section').forEach(el=>el.classList.add('hidden'));
  $(`view-${name}`).classList.remove('hidden');
  qsa('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===name));
  const meta=viewMeta[name];
  $('pageEyebrow').textContent=meta[0];
  $('pageTitle').textContent=meta[1];
  $('pageSubtitle').textContent=meta[2];
  try{
    if(name==='presence')await loadPresence();
    if(name==='students')await loadStudents();
    if(name==='student-profile'&&activeStudentProfileId)await loadStudentProfile();
    if(name==='guardians')await loadGuardians();
    if(name==='notifications')await loadNotifications();
    if(name==='reports')await loadReports();
    if(name==='messages')await loadMessages();
    if(name==='audit')await loadAudit();
    if(name==='feedback')await loadFeedback();
  }catch(error){
    toast(error.message)
  }
  closeMobileNav();
}
