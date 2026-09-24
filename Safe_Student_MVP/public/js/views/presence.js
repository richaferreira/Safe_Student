/**
 * Operação da Portaria, consulta de estado e leitura de QR.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function loadPresence(){
  await loadStudents();
  if(!dashboard)await loadDashboard();
  renderPresenceRecent()
}
function renderPresenceRecent(){
  const rows=(dashboard?.attendance||[]).slice(0,12);
  $('presenceRecent').innerHTML=rows.map(r=>`<article><span class="event-icon ${r.type==='SAIDA'?'exit':''}">${icon(r.type==='ENTRADA'?'i-in':'i-out')}</span><div><button class="student-name-link" type="button" data-student-profile="${r.studentId}">${escapeHtml(r.student)}</button><small>${r.type==='ENTRADA'?'Entrada':'Saída'} · ${fmt(r.timestamp)}</small></div></article>`).join('')||'<p class="empty">Nenhuma movimentação recente.</p>'
}
// Consulta o aluno antes do registro para descobrir a próxima ação válida.
async function lookupPresence(token=$('studentToken').value,method='TOKEN_MANUAL'){
  const value=String(token||'').trim();
  if(!value){
    toast('Informe um token.');
    return
  }
  const data=await api(`/api/attendance/lookup?token=${encodeURIComponent(value)}`);
  presenceSelection=data;
  presenceMethod=method;
  $('studentToken').value=data.student.token||value;
  $('presenceLookupEmpty').classList.add('hidden');
  $('presenceStudentCard').classList.remove('hidden');
  $('presenceAvatar').textContent=initials(data.student.name);
  $('presenceStudentName').textContent=data.student.name;
  $('presenceStudentName').dataset.studentProfile=data.student.id;
  $('presenceStudentClass').textContent=data.student.className;
  $('presenceStudentEnrollment').textContent=data.student.enrollment;
  const state=data.operational.state;
  $('presenceState').textContent=state==='DENTRO'?'DENTRO*':state==='FORA'?'FORA*':'SEM REGISTRO';
  $('presenceState').className=`status-badge ${state==='DENTRO'?'inside':state==='FORA'?'outside':'neutral'}`;
  $('presenceLastEvent').textContent=data.operational.lastTimestamp?`${data.operational.lastType} · ${fmt(data.operational.lastTimestamp)}`:'Nenhum evento hoje';
  $('presenceNextActionText').textContent=data.nextAction==='ENTRADA'?'Registrar entrada':'Registrar saída';
  $('registerBtn').textContent=data.nextAction==='ENTRADA'?'Registrar entrada':'Registrar saída';
  $('registerBtn').classList.toggle('danger-action',data.nextAction==='SAIDA');
  $('registerFeedback').textContent='';
}
async function registerPresence(){
  if(!presenceSelection)return toast('Consulte o estudante primeiro.');
  const type=presenceSelection.nextAction;
  const result=await api('/api/attendance',{
    method:'POST',body:JSON.stringify({
      token:$('studentToken').value,type,method:presenceMethod
    })
  });
  $('registerFeedback').textContent=`${result.student.name}: ${result.record.type.toLowerCase()} registrada. ${result.notified} responsável(is) notificado(s).`;
  $('registerFeedback').className='feedback ok';
  toast('Movimentação registrada.');
  await loadDashboard();
  await lookupPresence($('studentToken').value,presenceMethod);
  renderPresenceRecent()
}
// BarcodeDetector é opcional; o token manual continua disponível quando não houver suporte.
async function startQr(){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){
    toast('Leitura de QR não disponível neste navegador. Use o token manual.');
    return
  }
  try{
    qrStream=await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:'environment'
      }
    });
    $('qrVideo').srcObject=qrStream;
    await $('qrVideo').play();
    $('qrReader').classList.remove('hidden');
    const detector=new BarcodeDetector({
      formats:['qr_code']
    });
    qrTimer=setInterval(async()=>{
      try{
        const codes=await detector.detect($('qrVideo'));if(codes[0]?.rawValue){
          const raw=codes[0].rawValue;stopQr();$('studentToken').value=raw;await lookupPresence(raw,'QR_CAMERA')
        }
      }catch{
      }
    },350)
  }catch(error){
    toast('Não foi possível acessar a câmera. Use o token manual.')
  }
}
function stopQr(){
  if(qrTimer){
    clearInterval(qrTimer);
    qrTimer=null
  }
  if(qrStream){
    qrStream.getTracks().forEach(t=>t.stop());
    qrStream=null
  }
  $('qrReader')?.classList.add('hidden')
}
