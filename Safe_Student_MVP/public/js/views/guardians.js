/**
 * Central de responsáveis, vínculos e convites.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function loadGuardians(){
  guardianData=await api('/api/guardians');
  guardianCatalog=guardianData.guardians.filter(g=>g.status==='ATIVO');
  renderGuardians()
}
function renderGuardians(){
  const q=($('guardianSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');
  const filter=$('guardianAccountFilter')?.value||'';
  const active=guardianData.guardians.filter(g=>(!filter||filter==='ATIVO')&&(!q||[g.name,g.email,...(g.students||[]).map(s=>s.name)].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))));
  const invitations=guardianData.invitations.filter(inv=>(!filter||filter==='PENDENTE')&&(!q||[inv.name,inv.email,...(inv.students||[]).map(s=>s.name)].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))));
  $('familySummary').innerHTML=`<article><strong>${guardianData.guardians.length}</strong><span>contas de responsável</span></article><article><strong>${guardianData.invitations.length}</strong><span>convites pendentes</span></article><article><strong>${guardianData.guardians.reduce((n,g)=>n+(g.students||[]).length,0)}</strong><span>vínculos ativos</span></article>`;
  $('guardiansTable').innerHTML=active.map(g=>`<article class="guardian-card"><div class="guardian-card-head"><span class="student-avatar">${initials(g.name)}</span><div><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.email)} · ${escapeHtml(g.phone||'sem telefone')}</span></div><span class="status-badge inside">${escapeHtml(g.status)}</span></div><div class="linked-children">${(g.students||[]).map(s=>`<span><button class="student-name-link compact" type="button" data-student-profile="${s.id}">${
    escapeHtml(s.name)
  }
  </button> <small>${escapeHtml(s.className)}</small><button data-remove-link="${g.id}|${s.id}" title="Remover vínculo">×</button></span>`).join('')||'<em>Sem aluno vinculado</em>'}</div></article>`).join('')||'<p class="empty">Nenhum responsável encontrado.</p>';
  $('invitationsTable').innerHTML=invitations.map(inv=>`<article class="guardian-card invite-card"><div class="guardian-card-head"><span class="student-avatar pending">${initials(inv.name)}</span><div><strong>${escapeHtml(inv.name)}</strong><span>${escapeHtml(inv.email)} · ${inv.daysRemaining} dia(s) restante(s)</span></div><span class="status-badge neutral">PENDENTE</span></div><div class="linked-children">${(inv.students||[]).map(s=>`<span><button class="student-name-link compact" type="button" data-student-profile="${s.id}">${
    escapeHtml(s.name)
  }
  </button> <small>${escapeHtml(s.className)}</small></span>`).join('')}</div><div class="form-actions"><button class="btn secondary" data-renew-invite="${inv.id}">Renovar código</button><button class="btn ghost danger" data-revoke-invite="${inv.id}">Revogar</button></div></article>`).join('')||'<p class="empty">Nenhum convite pendente.</p>';
}
