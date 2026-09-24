/**
 * Consultas e regras auxiliares relacionadas aos alunos.
 */
const crypto = require('crypto');
const { dateKey } = require('../utils/dateTime');
const {
  canRegisterAttendance,
  canManageSchool,
} = require('./domain');

function className(database, classId) {
  const item = database.classes.find((schoolClass) => schoolClass.id === classId);
  return item ? `${item.name} - ${item.shift}` : 'Sem turma';
}

function studentById(database, id) {
  return database.students.find((student) => student.id === id);
}

function userById(database, id) {
  return database.users.find((user) => user.id === id);
}

function uniqueStudentToken(database) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const token = `SS-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    if (!database.students.some((student) => student.token === token)) return token;
  }
  throw new Error('Não foi possível gerar token único para o aluno.');
}

function studentOperationalStatus(database, studentId) {
  const today = dateKey();
  const last = (database.attendance || [])
    .filter(
      (record) => record.studentId === studentId && dateKey(record.timestamp) === today,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  if (!last) {
    return {
      state: 'SEM_REGISTRO',
      label: 'Sem registro hoje',
      nextAction: 'ENTRADA',
      lastType: null,
      lastTimestamp: null,
    };
  }

  if (last.type === 'ENTRADA') {
    return {
      state: 'DENTRO',
      label: 'Entrada registrada',
      nextAction: 'SAIDA',
      lastType: last.type,
      lastTimestamp: last.timestamp,
    };
  }

  return {
    state: 'FORA',
    label: 'Saída registrada',
    nextAction: 'ENTRADA',
    lastType: last.type,
    lastTimestamp: last.timestamp,
  };
}

function studentView(user, database, student, { includeGuardians = false } = {}) {
  const view = {
    id: student.id,
    name: student.name,
    enrollment: student.enrollment,
    classId: student.classId,
    className: className(database, student.classId),
    status: student.status,
    operational: studentOperationalStatus(database, student.id),
  };

  if (canRegisterAttendance(user.role)) view.token = student.token;

  if (includeGuardians) {
    view.guardians = canManageSchool(user.role)
      ? [
          ...database.users
            .filter(
              (candidate) =>
                candidate.role === 'RESPONSAVEL' &&
                (candidate.studentIds || []).includes(student.id),
            )
            .map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              status: 'ATIVO',
            })),
          ...(database.guardianInvitations || [])
            .filter(
              (invitation) =>
                invitation.status === 'PENDENTE' &&
                invitation.studentIds.includes(student.id),
            )
            .map((invitation) => ({
              id: invitation.id,
              name: invitation.name,
              status: 'CONVITE_PENDENTE',
            })),
        ]
      : [];
  }

  return view;
}

function profileAuditForStudent(database, student) {
  const attendanceIds = new Set(
    (database.attendance || [])
      .filter((row) => row.studentId === student.id)
      .map((row) => row.id),
  );

  const invitationIds = new Set(
    (database.guardianInvitations || [])
      .filter((invitation) => (invitation.studentIds || []).includes(student.id))
      .map((invitation) => invitation.id),
  );

  return (database.audit || []).filter(
    (event) =>
      event.entityId === student.id ||
      (event.entity === 'presenca' && attendanceIds.has(event.entityId)) ||
      (event.entity === 'convite' && invitationIds.has(event.entityId)),
  );
}

module.exports = {
  className,
  studentById,
  userById,
  uniqueStudentToken,
  studentOperationalStatus,
  studentView,
  profileAuditForStudent,
};
