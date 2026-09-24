/**
 * Associação dos eventos da interface aos fluxos do sistema.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
// Centraliza os listeners para evitar atributos onclick espalhados pelo HTML.
function bindEvents(){
  $('mobileNavBtn').addEventListener('click',()=>{
    const on=document.body.classList.toggle('mobile-nav-open');$('mobileNavBtn').setAttribute('aria-expanded',String(on))
  });
  qsa('.nav-item').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
  document.addEventListener('click',async event=>{
    const profile=event.target.closest('[data-student-profile]');if(profile){
      await openStudentProfile(profile.dataset.studentProfile);return
    }
    const go=event.target.closest('[data-go]');if(go){
      if(go.dataset.go==='students-new'){
        await goView('students');openStudentForm()
      }else await goView(go.dataset.go);return
    }
    const use=event.target.closest('[data-use-token]');if(use){
      await goView('presence');$('studentToken').value=use.dataset.useToken;await lookupPresence(use.dataset.useToken);return
    }
    const edit=event.target.closest('[data-edit-student]');if(edit){
      const s=students.find(x=>x.id===edit.dataset.editStudent);if(!s)return;editingStudentId=s.id;$('editStudentName').value=s.name;$('editStudentEnrollment').value=s.enrollment;$('editStudentClass').value=s.classId;$('editStudentStatus').value=s.status;$('editStudentPanel').classList.remove('hidden');$('editStudentPanel').scrollIntoView({
        behavior:'smooth'
      });return
    }
    const link=event.target.closest('[data-link-student]');if(link){
      $('linkStudent').value=link.dataset.linkStudent;$('linkPanel').classList.remove('hidden');$('linkPanel').scrollIntoView({
        behavior:'smooth'
      });return
    }
    const removeG=event.target.closest('[data-remove-guardian]');if(removeG){
      guardianDrafts.splice(Number(removeG.dataset.removeGuardian),1);renderGuardianRows();return
    }
    const copy=event.target.closest('[data-copy-invite]');if(copy){
      const [email,code]=copy.dataset.copyInvite.split('|');await navigator.clipboard.writeText(`Safe Student - ativação de responsável\nE-mail: ${email}\nCódigo: ${code}\nUse somente no portal oficial da escola.`).catch(()=>{
      });toast('Convite copiado.');return
    }
    const removeLink=event.target.closest('[data-remove-link]');if(removeLink){
      const [guardianId,studentId]=removeLink.dataset.removeLink.split('|');if(confirm('Remover este vínculo familiar?')){
        await api('/api/links',{
          method:'DELETE',body:JSON.stringify({
            guardianId,studentId
          })
        });toast('Vínculo removido.');await loadGuardians();await loadDashboard()
      }
      return
    }
    const renew=event.target.closest('[data-renew-invite]');if(renew){
      const data=await api(`/api/guardians/invitations/${renew.dataset.renewInvite}/renew`,{
        method:'POST'
      });await navigator.clipboard.writeText(`Código Safe Student: ${data.activationCode}`).catch(()=>{
      });toast(`Código renovado: ${data.activationCode}`);await loadGuardians();return
    }
    const revoke=event.target.closest('[data-revoke-invite]');if(revoke){
      if(confirm('Revogar este convite?')){
        await api(`/api/guardians/invitations/${revoke.dataset.revokeInvite}`,{
          method:'DELETE'
        });toast('Convite revogado.');await loadGuardians()
      }
      return
    }
    const read=event.target.closest('[data-read-notification]');if(read){
      await api(`/api/notifications/${read.dataset.readNotification}`,{
        method:'PATCH'
      });await loadNotifications();await loadDashboard();return
    }
    const conv=event.target.closest('[data-conversation]');if(conv){
      activeConversationPeer=conv.dataset.conversation;await loadMessages();return
    }
  });
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('loginSubmitBtn');btn.disabled=true;$('loginError').textContent='';try{
      await login($('email').value,$('password').value)
    }catch(error){
      $('loginError').textContent=error.message
    }finally{
      btn.disabled=false
    }
  });
  qsa('[data-login]').forEach(b=>b.addEventListener('click',()=>{
    $('email').value=b.dataset.login;$('password').value='demo123'
  }));
  $('logoutBtn').addEventListener('click',async()=>{
    try{
      await api('/api/logout',{
        method:'POST'
      })
    }catch{
    }
    logoutLocal()
  });
  $('headerNotifications').addEventListener('click',()=>goView('notifications'));
  $('togglePassword').addEventListener('click',()=>{
    const input=$('password');input.type=input.type==='password'?'text':'password'
  });
  $('forgotPasswordBtn').addEventListener('click',()=>{
    $('loginForm').classList.add('hidden');$('guardianRegisterForm').classList.add('hidden');$('passwordResetForm').classList.remove('hidden');$('resetEmail').value=$('email').value
  });
  $('backFromResetBtn').addEventListener('click',()=>{
    $('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden')
  });
  $('requestResetBtn').addEventListener('click',async()=>{
    try{
      const d=await api('/api/password/forgot',{
        method:'POST',body:JSON.stringify({
          email:$('resetEmail').value
        })
      });$('resetCodeArea').classList.remove('hidden');$('resetDemoCode').textContent=d.demoCode||'Código gerado.'
    }catch(e){
      $('resetError').textContent=e.message
    }
  });
  $('passwordResetForm').addEventListener('submit',async e=>{
    e.preventDefault();try{
      await api('/api/password/reset',{
        method:'POST',body:JSON.stringify({
          email:$('resetEmail').value,code:$('resetCode').value,password:$('resetPassword').value,confirmPassword:$('resetConfirm').value
        })
      });$('passwordResetForm').classList.add('hidden');$('loginForm').classList.remove('hidden');toast('Senha redefinida.')
    }catch(error){
      $('resetError').textContent=error.message
    }
  });
  $('showRegisterBtn').addEventListener('click',()=>{
    $('loginForm').classList.add('hidden');$('guardianRegisterForm').classList.remove('hidden')
  });
  $('backLoginBtn').addEventListener('click',()=>{
    $('guardianRegisterForm').classList.add('hidden');$('loginForm').classList.remove('hidden')
  });
  $('guardianRegisterForm').addEventListener('submit',async e=>{
    e.preventDefault();$('registerError').textContent='';try{
      const d=await api('/api/guardian/register',{
        method:'POST',body:JSON.stringify({
          email:$('regEmail').value,code:$('regCode').value,cpf:$('regCpf').value,password:$('regPassword').value,confirmPassword:$('regConfirm').value
        })
      });currentUser=d.user;await loadDashboard();await goView('dashboard');toast(`${d.childrenLinked} filho(s) vinculado(s).`)
    }catch(error){
      $('registerError').textContent=error.message
    }
  });
  $('studentSearch').addEventListener('input',renderStudents);
  $('studentStatusFilter').addEventListener('change',renderStudents);
  $('newStudentBtn').addEventListener('click',openStudentForm);
  $('cancelStudentBtn').addEventListener('click',()=>$('studentFormPanel').classList.add('hidden'));
  $('cancelStudentBtnBottom').addEventListener('click',()=>$('studentFormPanel').classList.add('hidden'));
  $('addGuardianBtn').addEventListener('click',()=>{
    if(guardianDrafts.length>=4)return toast('Limite de quatro responsáveis por matrícula.');guardianDrafts.push(defaultGuardian());renderGuardianRows()
  });
  $('guardianRows').addEventListener('input',e=>syncGuardianDraftFromEvent(e.target));
  $('guardianRows').addEventListener('change',e=>syncGuardianDraftFromEvent(e.target));
  ['newStudentName','newStudentEnrollment','newStudentClass'].forEach(id=>$(id).addEventListener('input',updateStudentReview));
  $('saveStudentBtn').addEventListener('click',()=>saveStudent().catch(e=>toast(e.message)));
  $('cancelEditStudentBtn').addEventListener('click',()=>$('editStudentPanel').classList.add('hidden'));
  $('saveEditStudentBtn').addEventListener('click',async()=>{
    try{
      await api(`/api/students/${editingStudentId}`,{
        method:'PATCH',body:JSON.stringify({
          name:$('editStudentName').value,enrollment:$('editStudentEnrollment').value,classId:$('editStudentClass').value,status:$('editStudentStatus').value
        })
      });$('editStudentPanel').classList.add('hidden');toast('Aluno atualizado.');await loadStudents();await loadDashboard()
    }catch(e){
      toast(e.message)
    }
  });
  $('linkMode').addEventListener('change',()=>{
    const n=$('linkMode').value==='new';$('linkExistingFields').classList.toggle('hidden',n);$('linkNewFields').classList.toggle('hidden',!n)
  });
  $('cancelLinkBtn').addEventListener('click',()=>$('linkPanel').classList.add('hidden'));
  $('saveLinkBtn').addEventListener('click',async()=>{
    try{
      let result;if($('linkMode').value==='existing')result=await api('/api/links',{
        method:'POST',body:JSON.stringify({
          studentId:$('linkStudent').value,guardianId:$('linkGuardian').value
        })
      });else result=await api('/api/guardians/invitations',{
        method:'POST',body:JSON.stringify({
          studentId:$('linkStudent').value,guardian:{
            name:$('linkGuardianName').value,email:$('linkGuardianEmail').value,phone:$('linkGuardianPhone').value,relationship:$('linkGuardianRelation').value,cpf:$('linkGuardianCpf').value
          }
        })
      });$('linkPanel').classList.add('hidden');toast(result.activationCode?`Convite gerado: ${result.activationCode}`:'Responsável vinculado.');await loadStudents();await loadDashboard()
    }catch(e){
      toast(e.message)
    }
  });
  $('guardianSearch').addEventListener('input',renderGuardians);
  $('guardianAccountFilter').addEventListener('change',renderGuardians);
  $('refreshGuardiansBtn').addEventListener('click',()=>loadGuardians().then(()=>toast('Central atualizada.')));
  $('lookupStudentBtn').addEventListener('click',()=>lookupPresence().catch(e=>toast(e.message)));
  $('studentToken').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();lookupPresence().catch(er=>toast(er.message))
    }
  });
  $('registerBtn').addEventListener('click',()=>registerPresence().catch(e=>{
    $('registerFeedback').textContent=e.message;$('registerFeedback').className='feedback err'
  }));
  $('startQrBtn').addEventListener('click',startQr);
  $('stopQrBtn').addEventListener('click',stopQr);
  $('notificationReadFilter').addEventListener('change',()=>loadNotifications().catch(e=>toast(e.message)));
  $('notificationStudentFilter').addEventListener('change',()=>loadNotifications().catch(e=>toast(e.message)));
  $('markAllReadBtn').addEventListener('click',async()=>{
    const ids=($('markAllReadBtn').dataset.ids||'').split(',').filter(Boolean);await Promise.all(ids.map(id=>api(`/api/notifications/${id}`,{
      method:'PATCH'
    })));toast(ids.length?'Notificações marcadas como lidas.':'Nada para marcar.');await loadNotifications();await loadDashboard()
  });
  $('applyReportBtn').addEventListener('click',()=>loadReports().catch(e=>toast(e.message)));
  $('clearReportBtn').addEventListener('click',()=>{
    ['reportFrom','reportTo','reportClass','reportStudent','reportType'].forEach(id=>$(id).value='');loadReports().catch(e=>toast(e.message))
  });
  qsa('.report-tab').forEach(b=>b.addEventListener('click',()=>{
    reportMode=b.dataset.reportView;renderReportTable()
  }));
  $('csvBtn').addEventListener('click',async()=>{
    try{
      downloadBlob(await apiBlob('/api/reports.csv'+reportQuery()),'safe-student-movimentacoes.csv')
    }catch(e){
      toast(e.message)
    }
  });
  $('newConversationBtn').addEventListener('click',()=>{
    activeConversationPeer='';renderThread(null);$('messageTo').focus()
  });
  $('sendMessageBtn').addEventListener('click',async()=>{
    const to=$('messageTo').value;if(!to)return toast('Escolha um destinatário.');try{
      await api('/api/messages',{
        method:'POST',body:JSON.stringify({
          toUserId:to,text:$('messageText').value
        })
      });$('messageText').value='';activeConversationPeer=to;await loadMessages();toast('Mensagem enviada.')
    }catch(e){
      toast(e.message)
    }
  });
  $('applyAuditBtn').addEventListener('click',()=>loadAudit().catch(e=>toast(e.message)));
  $('clearAuditBtn').addEventListener('click',()=>{
    ['auditFrom','auditTo','auditAction','auditUser','auditQuery'].forEach(id=>$(id).value='');loadAudit().catch(e=>toast(e.message))
  });
  $('studentProfileBack').addEventListener('click',()=>closeStudentProfile().catch(e=>toast(e.message)));
  $('applyStudentHistory').addEventListener('click',()=>loadStudentProfile().catch(e=>toast(e.message)));
  $('clearStudentHistory').addEventListener('click',()=>{
    ['studentHistoryFrom','studentHistoryTo','studentHistoryType','studentHistoryQuery'].forEach(id=>$(id).value='');loadStudentProfile().catch(e=>toast(e.message))
  });
  $('studentHistoryQuery').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();loadStudentProfile().catch(er=>toast(er.message))
    }
  });
  qsa('.profile-tab').forEach(btn=>btn.addEventListener('click',()=>{
    studentProfileTab=btn.dataset.profileTab;renderStudentProfileTab()
  }));
  $('studentProfileOperate').addEventListener('click',async()=>{
    const token=$('studentProfileOperate').dataset.token;if(!token)return;await goView('presence');$('studentToken').value=token;await lookupPresence(token)
  });
  $('studentProfileEdit').addEventListener('click',async()=>{
    const id=$('studentProfileEdit').dataset.editStudent;await goView('students');const s=students.find(x=>x.id===id);if(!s)return toast('Recarregue a lista de alunos.');editingStudentId=s.id;$('editStudentName').value=s.name;$('editStudentEnrollment').value=s.enrollment;$('editStudentClass').value=s.classId;$('editStudentStatus').value=s.status;$('editStudentPanel').classList.remove('hidden');$('editStudentPanel').scrollIntoView({
      behavior:'smooth'
    })
  });
  $('saveFeedbackBtn').addEventListener('click',async()=>{
    try{
      await api('/api/feedback',{
        method:'POST',body:JSON.stringify({
          profile:$('feedbackProfile').value,scenario:$('feedbackScenario').value,success:$('feedbackSuccess').value==='SIM',timeSeconds:$('feedbackTime').value,score:Number($('feedbackScore').value),comment:$('feedbackComment').value
        })
      });toast('Avaliação registrada.');await loadFeedback()
    }catch(e){
      toast(e.message)
    }
  });
  $('feedbackCsvBtn').addEventListener('click',async()=>{
    try{
      downloadBlob(await apiBlob('/api/feedback.csv'),'safe-student-validacao.csv')
    }catch(e){
      toast(e.message)
    }
  });
  $('globalSearch').addEventListener('input',()=>{
    clearTimeout(window.__searchTimer);window.__searchTimer=setTimeout(executeGlobalSearch,220)
  });
  $('globalSearchBtn').addEventListener('click',executeGlobalSearch);
  $('globalSearch').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();executeGlobalSearch()
    }
  });
  $('globalSearchResults').addEventListener('click',e=>{
    const item=e.target.closest('[data-search-view]');if(item){
      $('globalSearchResults').classList.add('hidden');goView(item.dataset.searchView)
    }
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('.global-search'))$('globalSearchResults').classList.add('hidden')
  });
  $('themeBtn').addEventListener('click',()=>{
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;safeStoreSet('ss_theme',next)
  });
  document.documentElement.dataset.theme=safeStoreGet('ss_theme')||'light';
}
