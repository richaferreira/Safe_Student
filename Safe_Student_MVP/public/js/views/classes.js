/**
 * Gestão de Turmas - Safe Student
 * Permite que a Gestão Escolar cadastre, visualize, edite e controle o status
 * das turmas (Manhã, Tarde, Noite, Integral) antes e durante as matrículas.
 */

let editingClassId = null;

async function loadClassesView() {
  const data = await api('/api/classes');
  classCatalog = data.classes || [];
  renderClassesTable();
}

function renderClassesTable() {
  const container = $('classesTable');
  if (!container) return;

  const search = ($('classSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const statusFilter = $('classStatusFilter')?.value || '';

  const filtered = classCatalog.filter((c) => {
    const matchStatus = !statusFilter || (c.status || 'ATIVO') === statusFilter;
    const matchSearch = !search || [c.name, c.shift].some((v) =>
      String(v || '').toLocaleLowerCase('pt-BR').includes(search)
    );
    return matchStatus && matchSearch;
  });

  const activeCount = classCatalog.filter((c) => (c.status || 'ATIVO') === 'ATIVO').length;
  const totalStudents = classCatalog.reduce((sum, c) => sum + (c.totalStudents || 0), 0);

  if ($('classesCountBadge')) {
    $('classesCountBadge').textContent = `${classCatalog.length} turma(s) · ${activeCount} ativa(s)`;
  }
  if ($('classesTotalStudentsBadge')) {
    $('classesTotalStudentsBadge').textContent = `${totalStudents} estudante(s) matriculado(s)`;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Turma</th>
          <th>Turno</th>
          <th>Estudantes Matriculados</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((c) => {
          const isActive = (c.status || 'ATIVO') === 'ATIVO';
          const studentCount = c.studentCount || 0;
          return `
            <tr>
              <td>
                <div class="class-cell">
                  <strong>${escapeHtml(c.name)}</strong>
                  <small>ID: ${escapeHtml(c.id)}</small>
                </div>
              </td>
              <td><span class="shift-chip">${escapeHtml(c.shift)}</span></td>
              <td>
                <b>${studentCount}</b> aluno(s) ativo(s)
                ${c.totalStudents > studentCount ? `<small class="muted">(${c.totalStudents} no total)</small>` : ''}
              </td>
              <td>
                <span class="status-badge ${isActive ? 'inside' : 'neutral'}">
                  ${isActive ? 'ATIVO' : 'INATIVO'}
                </span>
              </td>
              <td class="actions">
                <button type="button" class="text-btn" data-edit-class="${escapeHtml(c.id)}">Editar</button>
                <button type="button" class="text-btn ${isActive ? 'danger' : ''}" data-toggle-class-status="${escapeHtml(c.id)}">
                  ${isActive ? 'Desativar' : 'Ativar'}
                </button>
                ${(c.totalStudents || 0) === 0 ? `
                  <button type="button" class="text-btn danger" data-delete-class="${escapeHtml(c.id)}">Excluir</button>
                ` : `
                  <span class="muted" title="Turma com alunos vinculados não pode ser excluída fisicamente (Integridade referencial FK). Inative a turma para preservar o histórico.">Protegida por FK</span>
                `}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    ${!filtered.length ? '<p class="empty">Nenhuma turma encontrada com os filtros selecionados.</p>' : ''}
  `;
}

function openClassForm(classItem = null) {
  const panel = $('classFormPanel');
  if (!panel) return;

  if (classItem) {
    editingClassId = classItem.id;
    $('classFormTitle').textContent = 'Editar Turma';
    $('classFormName').value = classItem.name || '';
    $('classFormShift').value = classItem.shift || 'Manhã';
    $('classFormStatus').value = classItem.status || 'ATIVO';
  } else {
    editingClassId = null;
    $('classFormTitle').textContent = 'Cadastrar Nova Turma';
    $('classFormName').value = '';
    $('classFormShift').value = 'Manhã';
    $('classFormStatus').value = 'ATIVO';
  }

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('classFormName').focus();
}

function closeClassForm() {
  const panel = $('classFormPanel');
  if (panel) panel.classList.add('hidden');
  editingClassId = null;
}

async function saveClassForm() {
  const name = ($('classFormName')?.value || '').trim();
  const shift = $('classFormShift')?.value || 'Manhã';
  const status = $('classFormStatus')?.value || 'ATIVO';

  if (!name || name.length < 2) {
    toast('Informe um nome válido para a turma (mínimo 2 caracteres).');
    return;
  }

  try {
    if (editingClassId) {
      await api(`/api/classes/${editingClassId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, shift, status }),
      });
      toast(`Turma "${name}" atualizada com sucesso.`);
    } else {
      const res = await api('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name, shift, status }),
      });
      toast(`Turma "${name}" cadastrada com sucesso.`);
    }

    closeClassForm();
    await loadClassesView();
    // Atualiza também os selects de turma na tela de alunos
    if (typeof populateStudentSelectors === 'function') {
      populateStudentSelectors();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function toggleClassStatus(id) {
  const c = classCatalog.find((x) => x.id === id);
  if (!c) return;
  const newStatus = (c.status || 'ATIVO') === 'ATIVO' ? 'INATIVO' : 'ATIVO';
  try {
    await api(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    toast(`Turma "${c.name}" alterada para ${newStatus}.`);
    await loadClassesView();
    if (typeof populateStudentSelectors === 'function') {
      populateStudentSelectors();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function deleteClass(id) {
  const c = classCatalog.find((x) => x.id === id);
  if (!c) return;

  if (!confirm(`Tem certeza que deseja excluir a turma "${c.name}"? Esta ação removerá a turma do banco SQLite.`)) {
    return;
  }

  try {
    await api(`/api/classes/${id}`, { method: 'DELETE' });
    toast(`Turma "${c.name}" excluída.`);
    await loadClassesView();
    if (typeof populateStudentSelectors === 'function') {
      populateStudentSelectors();
    }
  } catch (error) {
    toast(error.message);
  }
}
