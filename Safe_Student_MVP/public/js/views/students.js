/**
 * Lista de alunos e matrícula integrada com responsáveis.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
// Carrega alunos e, para a Gestão, também turmas e responsáveis ativos.
async function loadStudents(){
  const requests=[api('/api/students')];
  if(isManager())requests.push(api('/api/classes'),api('/api/guardians'));
  const result=await Promise.all(requests);
  students=result[0].students||[];
  if(isManager()){
    classCatalog=result[1].classes||[];
    guardianData=result[2];
    guardianCatalog=guardianData.guardians.filter(g=>g.status==='ATIVO')
  }
  renderStudents();
  populateStudentSelectors();
}
function stateBadge(student){
  const state=student.operational?.state||'SEM_REGISTRO';
  const label=state==='DENTRO'?'DENTRO*':state==='FORA'?'FORA*':'SEM REGISTRO';
  const cls=state==='DENTRO'?'inside':state==='FORA'?'outside':'neutral';
  return `<span class="status-badge ${cls}" title="Estado derivado do último evento de portaria de hoje">${label}</span>`
}
function renderStudents(){
  const term=($('studentSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');
  const status=$('studentStatusFilter')?.value||'';
  const list=students.filter(s=>(!status||s.status===status)&&(!term||[s.name,s.enrollment,s.className].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term))));
  $('studentsTable').innerHTML=`<table><thead><tr><th>Aluno</th><th>Turma</th><th>Situação operacional</th><th>Responsáveis</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(s=>`<tr><td><div class="person-cell"><span class="student-avatar sm">${
    initials(s.name)
  }
  </span><span><button type="button" class="student-name-link" data-student-profile="${s.id}">${escapeHtml(s.name)}</button><small>${
    escapeHtml(s.enrollment)
  }
  </small></span></div></td><td>${
    escapeHtml(s.className)
  }
  </td><td>${stateBadge(s)}<small class="table-sub">${s.operational?.lastTimestamp?fmt(s.operational.lastTimestamp):'Hoje sem evento'}</small></td><td>${(s.guardians||[]).length?(s.guardians||[]).map(g=>`<span class="guardian-chip">${escapeHtml(g.name)} · ${g.status==='CONVITE_PENDENTE'?'convite':'ativo'}</span>`).join(' '):'<span class="muted">Sem vínculo</span>'}</td><td><span class="status-badge ${s.status==='ATIVO'?'inside':'neutral'}">${s.status}</span></td><td class="actions">${isOperator()&&s.status==='ATIVO'&&s.token?`<button class="text-btn" data-use-token="${escapeHtml(s.token)}">Portaria</button>`:''}${isManager()?`<button class="text-btn" data-edit-student="${s.id}">Editar</button><button class="text-btn" data-link-student="${s.id}">+ Responsável</button>`:''}</td></tr>`).join('')}</tbody></table>${!list.length?'<p class="empty">Nenhum aluno encontrado.</p>':''}`;
}
function populateStudentSelectors(){
  if(isManager()){
    const opts=classCatalog.map(c=>`<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.shift)}</option>`).join('');$('newStudentClass').innerHTML=opts;$('editStudentClass').innerHTML=opts;
    $('linkStudent').innerHTML=students.filter(s=>s.status==='ATIVO').map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.className)}</option>`).join('');
    $('linkGuardian').innerHTML=guardianCatalog.map(g=>`<option value="${g.id}">${escapeHtml(g.name)} · ${escapeHtml(g.email)}</option>`).join('');
  }
  $('studentTokenOptions').innerHTML=students.filter(s=>s.token&&s.status==='ATIVO').map(s=>`<option value="${escapeHtml(s.token)}">${escapeHtml(s.name)} · ${escapeHtml(s.className)}</option>`).join('');
}
function defaultGuardian(){return {mode:'new',guardianId:'',name:'',email:'',phone:'',relationship:'Mãe',cpf:''}}
function renderGuardianRows(){
  $('guardianRows').innerHTML=guardianDrafts.map((g,i)=>`<article class="guardian-builder-row" data-guardian-index="${i}"><div class="guardian-builder-head"><strong>Responsável ${i+1}</strong>${guardianDrafts.length>1?`<button type="button" class="text-btn danger" data-remove-guardian="${i}">Remover</button>`:''}</div><label>Origem<select data-g-field="mode"><option value="new" ${g.mode==='new'?'selected':''}>Cadastrar / reconhecer pelos dados</option><option value="existing" ${g.mode==='existing'?'selected':''}>Selecionar conta já ativa</option></select></label>${g.mode==='existing'?`<label>Responsável ativo<select data-g-field="guardianId">${guardianCatalog.map(x=>`<option value="${x.id}" ${g.guardianId===x.id?'selected':''}>${escapeHtml(x.name)} · ${escapeHtml(x.email)}</option>`).join('')}</select></label>`:`<div class="form-grid"><label>Nome<input data-g-field="name" value="${escapeHtml(g.name)}" /></label><label>E-mail<input data-g-field="email" type="email" value="${escapeHtml(g.email)}" /></label><label>Telefone<input data-g-field="phone" value="${escapeHtml(g.phone)}" placeholder="(22) 99999-9999" /></label><label>Vínculo<select data-g-field="relationship">${['Mãe','Pai','Responsável legal','Outro'].map(r=>`<option ${g.relationship===r?'selected':''}>${r}</option>`).join('')}</select></label><label>CPF (opcional)<input data-g-field="cpf" value="${escapeHtml(g.cpf)}" placeholder="000.000.000-00" /></label></div>`}</article>`).join('');
  updateStudentReview();
}
function updateStudentReview(){if(!$('studentReview'))return;const student=$('newStudentName').value||'Aluno ainda não informado';const enrollment=$('newStudentEnrollment').value||'—';const className=$('newStudentClass').selectedOptions[0]?.textContent||'—';$('studentReview').innerHTML=`<div><small>Aluno</small><strong>${escapeHtml(student)}</strong><span>${escapeHtml(enrollment)} · ${escapeHtml(className)}</span></div><div><small>Responsáveis</small><strong>${guardianDrafts.length}</strong><span>${guardianDrafts.map(g=>g.mode==='existing'?(guardianCatalog.find(x=>x.id===g.guardianId)?.name||'Conta existente'):(g.name||'Novo responsável')).map(escapeHtml).join(', ')}</span></div>`}
function syncGuardianDraftFromEvent(target){const row=target.closest('[data-guardian-index]');if(!row)return;const index=Number(row.dataset.guardianIndex);const field=target.dataset.gField;if(!field)return;guardianDrafts[index][field]=target.value;if(field==='mode'){if(target.value==='existing'&&!guardianDrafts[index].guardianId)guardianDrafts[index].guardianId=guardianCatalog[0]?.id||'';renderGuardianRows()}else updateStudentReview()}
function openStudentForm(){guardianDrafts=[defaultGuardian()];$('newStudentName').value='';$('newStudentEnrollment').value='';$('studentFormPanel').classList.remove('hidden');$('invitationResult').classList.add('hidden');renderGuardianRows();$('studentFormPanel').scrollIntoView({behavior:'smooth',block:'start'});$('newStudentName').focus()}
// Envia aluno e responsáveis em uma única operação para evitar matrícula sem vínculo familiar.
async function saveStudent(){
  const guardians=guardianDrafts.map(g=>g.mode==='existing'?{guardianId:g.guardianId}:{guardian:{name:g.name,email:g.email,phone:g.phone,relationship:g.relationship,cpf:g.cpf}});
  const result=await api('/api/students',{method:'POST',body:JSON.stringify({name:$('newStudentName').value,enrollment:$('newStudentEnrollment').value,classId:$('newStudentClass').value,guardians})});
  $('studentFormPanel').classList.add('hidden');
  const invitationResults=result.invitations||[];$('invitationResult').classList.toggle('hidden',!invitationResults.length);
  $('invitationList').innerHTML=invitationResults.map(({invitation,activationCode})=>`<article class="invite-result"><div><strong>${escapeHtml(invitation.name)}</strong><span>${escapeHtml(invitation.email)}</span></div><code>${escapeHtml(activationCode)}</code><button class="btn secondary" data-copy-invite="${escapeHtml(invitation.email)}|${escapeHtml(activationCode)}">Copiar convite</button></article>`).join('');
  toast(`Matrícula criada com ${result.student.guardians?.length||guardians.length} responsável(is).`);await loadStudents();await loadDashboard();await goView('students');
}
