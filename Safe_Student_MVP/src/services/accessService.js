/**
 * Funções de autorização e escopo de dados por perfil.
 */
const {
  allowedStudentIds,
  canManageSchool,
  canMessageRole,
} = require('./domain');

function directoryUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

function roleName(role) {
  return {
    RESPONSAVEL: 'Responsável',
    PORTARIA: 'Portaria',
    GESTAO: 'Gestão',
    ADMIN: 'Administrador',
  }[role] || role;
}

function canMessageUser(from, to) {
  if (!from || !to || from.id === to.id || to.status !== 'ATIVO') return false;
  return canMessageRole(from.role, to.role);
}

function visibleDirectory(user, database) {
  return database.users
    .filter((candidate) => canMessageUser(user, candidate))
    .map(directoryUser);
}

function scopedStudents(user, database) {
  if (canManageSchool(user.role)) return database.students;
  const ids = new Set(allowedStudentIds(user, database));
  return database.students.filter((student) => ids.has(student.id));
}

function canAccessStudent(user, database, student) {
  if (!user || !student) return false;
  if (canManageSchool(user.role)) return true;
  return allowedStudentIds(user, database).includes(student.id);
}

module.exports = {
  directoryUser,
  roleName,
  canMessageUser,
  visibleDirectory,
  scopedStudents,
  canAccessStudent,
};
