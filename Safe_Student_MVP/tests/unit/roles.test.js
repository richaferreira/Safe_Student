/**
 * RN-17: os perfis válidos são RESPONSAVEL, PORTARIA e GESTAO. O perfil ADMIN não existe
 * no banco e, por isso, não pode ter nenhuma permissão nas regras de domínio.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { canRegisterAttendance, canManageSchool, canViewAudit, canMessageRole, allowedStudentIds } = require('../../src/services/domain');

test('ADMIN não tem permissão nas regras de domínio', () => {
  assert.equal(canRegisterAttendance('ADMIN'), false);
  assert.equal(canManageSchool('ADMIN'), false);
  assert.equal(canViewAudit('ADMIN'), false);
  assert.equal(canMessageRole('ADMIN', 'GESTAO'), false);
  assert.equal(canMessageRole('GESTAO', 'ADMIN'), false);
  assert.deepEqual(allowedStudentIds({ role: 'ADMIN', studentIds: [] }, { students: [{ id: 's1', status: 'ATIVO' }] }), []);
});

test('os três perfis do documento 02 mantêm suas permissões', () => {
  assert.equal(canManageSchool('GESTAO'), true);
  assert.equal(canViewAudit('GESTAO'), true);
  assert.equal(canRegisterAttendance('PORTARIA'), true);
  assert.equal(canRegisterAttendance('RESPONSAVEL'), false);
  assert.equal(canMessageRole('RESPONSAVEL', 'RESPONSAVEL'), false);
});
