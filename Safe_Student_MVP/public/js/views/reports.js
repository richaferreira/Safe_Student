/**
 * Relatórios operacionais e exportação com os mesmos filtros.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
// A mesma query é reutilizada pela tela e pelo CSV para evitar resultados divergentes.
function reportQuery(){
  const p=new URLSearchParams();
  [['from','reportFrom'],['to','reportTo'],['classId','reportClass'],['studentId','reportStudent'],['type','reportType']].forEach(([key,id])=>{
    const v=$(id)?.value;if(v)p.set(key,v)
  });
  return p.toString()?`?${p}`:''
}
async function loadReports(){
  if(!students.length)await loadStudents();
  const classOptions=[...new Map(students.map(s=>[s.classId,s.className])).entries()];
  const oldClass=$('reportClass').value,oldStudent=$('reportStudent').value;
  $('reportClass').innerHTML='<option value="">Todas</option>'+classOptions.map(([id,name])=>`<option value="${id}">${escapeHtml(name)}</option>`).join('');
  $('reportStudent').innerHTML='<option value="">Todos</option>'+students.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.className)}</option>`).join('');
  if(oldClass)$('reportClass').value=oldClass;
  if(oldStudent)$('reportStudent').value=oldStudent;
  reportData=await api('/api/reports'+reportQuery());
  $('reportDisclaimer').textContent=reportData.disclaimer;
  const s=reportData.summary||{
  };
  $('reportMetrics').innerHTML=[['i-users',s.students||0,'alunos no filtro'],['i-table',s.movements||0,'movimentações'],['i-in',s.entradas||0,'entradas'],['i-out',s.saidas||0,'saídas']].map(([ic,v,l])=>`<article class="metric-card"><span class="metric-icon">${icon(ic)}</span><span class="metric-content"><strong>${v}</strong><span class="metric-context">${l}</span></span></article>`).join('');
  renderReportTable();
}
function renderReportTable(){
  qsa('.report-tab').forEach(b=>b.classList.toggle('active',b.dataset.reportView===reportMode));
  if(reportMode==='summary')$('reportsTable').innerHTML=`<table><thead><tr><th>Aluno</th><th>Turma</th><th>Entradas</th><th>Saídas</th><th>Último registro</th></tr></thead><tbody>${(reportData.rows||[]).map(r=>`<tr><td><button class="student-name-link" type="button" data-student-profile="${r.studentId}">${
    escapeHtml(r.name)
  }
  </button><small class="table-sub">${escapeHtml(r.enrollment)}</small></td><td>${escapeHtml(r.className)}</td><td>${
    r.entradas
  }
  </td><td>${r.saidas}</td><td>${
    fmt(r.ultimoRegistro)
  }
  </td></tr>`).join('')}</tbody></table>`;
  else $('reportsTable').innerHTML=`<table><thead><tr><th>Data/hora</th><th>Aluno</th><th>Turma</th><th>Movimento</th><th>Método</th></tr></thead><tbody>${(reportData.events||[]).map(r=>`<tr><td>${
    fmt(r.timestamp)
  }
  </td><td><button class="student-name-link" type="button" data-student-profile="${r.studentId}">${escapeHtml(r.name)}</button><small class="table-sub">${
    escapeHtml(r.enrollment)
  }
  </small></td><td>${
    escapeHtml(r.className)
  }
  </td><td><span class="movement-badge ${r.type==='ENTRADA'?'entry':'exit'}">${r.type}</span></td><td>${escapeHtml(r.method||'—')}</td></tr>`).join('')}</tbody></table>`;
}
