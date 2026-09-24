/**
 * Login, restauração da sessão e limpeza local do usuário.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function login(email,password){
  const data=await api('/api/login',{
    method:'POST',body:JSON.stringify({
      email,password
    })
  });
  currentUser=data.user;
  safeStoreSet('ss_user_hint',JSON.stringify(currentUser));
  await loadDashboard();
  await goView('dashboard')
}
function logoutLocal(){
  currentUser=null;
  dashboard=null;
  students=[];
  stopQr();
  safeStoreRemove('ss_user_hint');
  showShell(false)
}
async function restoreSession(){
  try{
    const me=await api('/api/me');
    currentUser=me.user;
    await loadDashboard();
    await goView('dashboard')
  }catch{
    logoutLocal()
  }
}
