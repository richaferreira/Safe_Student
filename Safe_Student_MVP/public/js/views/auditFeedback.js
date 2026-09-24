/**
 * Auditoria da gestão e evidências da validação acadêmica.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function loadAudit(){
  if(!isManager())return;
  const p=new URLSearchParams();
  [['from','auditFrom'],['to','auditTo'],['action','auditAction'],['userId','auditUser'],['q','auditQuery']].forEach(([k,id])=>{
    const v=$(id)?.value;if(v)p.set(k,v)
  });
  const data=await api('/api/audit'+(p.toString()?`?${p}`:''));
  if($('auditAction').options.length<=1)$('auditAction').innerHTML='<option value="">Todas</option>'+data.filters.actions.map(a=>`<option>${escapeHtml(a)}</option>`).join('');
  if($('auditUser').options.length<=1)$('auditUser').innerHTML='<option value="">Todos</option>'+data.filters.users.map(u=>`<option value="${u.id}">${escapeHtml(u.name)} · ${roleName(u.role)}</option>`).join('');
  $('auditCount').textContent=`${data.rows.length} evento(s)`;
  $('auditTable').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>${data.rows.map(a=>`<tr><td>${
    fmt(a.createdAt)
  }
  </td><td>${escapeHtml(a.userName)}</td><td><code>${
    escapeHtml(a.action)
  }
  </code></td><td>${
    escapeHtml(a.entity||'—')
  }
  </td><td>${escapeHtml(a.details||'—')}</td></tr>`).join('')}</tbody></table>`}
async function loadFeedback(){const d=await api('/api/feedback');$('feedbackMetrics').innerHTML=[['i-star',d.avg||0,'nota média'],['i-table',d.total||0,'avaliações'],['i-check',(d.successRate||0)+'%','sucesso'],['i-clock',d.avgTimeSeconds?d.avgTimeSeconds+'s':'—','tempo médio']].map(([ic,v,l])=>`<article class="metric-card"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><strong>${v}</strong><span class="metric-context">${l}</span></span></article>`).join('');$('feedbackDisclaimer').textContent=`${d.disclaimer} Registros ilustrativos: ${d.demoSeedCount||0}.`;$('feedbackList').innerHTML=(d.rows||[]).slice(0,12).map(f=>`<article class="list-card"><strong>${escapeHtml(f.profile)} · Nota ${f.score}/5</strong><small>${escapeHtml(f.scenario||'Cenário')} · ${fmt(f.createdAt)}</small><p>${escapeHtml(f.comment)}</p></article>`).join('')||'<p class="empty">Sem avaliações coletadas.</p>'}
