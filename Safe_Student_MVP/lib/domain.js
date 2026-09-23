function normalizeToken(value) {
  return String(value || '').trim().toUpperCase();
}

function canRegisterAttendance(role) {
  return ['PORTARIA', 'GESTAO', 'ADMIN'].includes(role);
}

function canManageSchool(role) {
  return ['GESTAO', 'ADMIN'].includes(role);
}

function canViewAudit(role) {
  return ['GESTAO', 'ADMIN'].includes(role);
}

function canMessageRole(fromRole, toRole) {
  const rules = {
    RESPONSAVEL: ['GESTAO', 'PORTARIA'],
    PORTARIA: ['RESPONSAVEL', 'GESTAO', 'ADMIN'],
    GESTAO: ['RESPONSAVEL', 'PORTARIA', 'ADMIN'],
    ADMIN: ['RESPONSAVEL', 'PORTARIA', 'GESTAO'],
  };
  return Boolean(rules[fromRole]?.includes(toRole));
}

function allowedStudentIds(user, db) {
  if (!user) return [];
  if (user.role === 'RESPONSAVEL') {
    return (user.studentIds || []).filter((id) => db.students.some((s) => s.id === id && s.status === 'ATIVO'));
  }
  if (['PORTARIA', 'GESTAO', 'ADMIN'].includes(user.role)) {
    return db.students.filter((s) => s.status === 'ATIVO').map((s) => s.id);
  }
  return [];
}

function sortedAttendance(records) {
  return [...(records || [])].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
}

function movementState(records) {
  const ordered = sortedAttendance(records);
  const last = ordered[ordered.length - 1] || null;
  if (!last) return { state: 'SEM_REGISTRO', label: 'Sem registro hoje', nextType: 'ENTRADA', last: null };
  if (last.type === 'ENTRADA') return { state: 'DENTRO', label: 'Entrada registrada', nextType: 'SAIDA', last };
  return { state: 'FORA', label: 'Saída registrada', nextType: 'ENTRADA', last };
}

function validateAttendanceSequence(records, type) {
  const status = movementState(records);
  if (type === 'ENTRADA' && status.nextType !== 'ENTRADA') {
    return { ok: false, error: 'Já existe entrada pendente para este aluno hoje.' };
  }
  if (type === 'SAIDA' && status.nextType !== 'SAIDA') {
    return { ok: false, error: 'Não há entrada válida para registrar saída.' };
  }
  return { ok: true };
}

function attendanceRate(records, schoolDays = 20, dayKey = (value) => String(value || '').slice(0, 10)) {
  const uniqueDays = new Set(
    records
      .filter((r) => r.type === 'ENTRADA')
      .map((r) => dayKey(r.timestamp))
      .filter(Boolean),
  );
  return schoolDays > 0 ? Math.min(100, Math.round((uniqueDays.size / schoolDays) * 100)) : 0;
}

module.exports = {
  normalizeToken,
  canRegisterAttendance,
  canManageSchool,
  canViewAudit,
  canMessageRole,
  allowedStudentIds,
  validateAttendanceSequence,
  attendanceRate,
  movementState,
};
