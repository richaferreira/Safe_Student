/**
 * Regras auxiliares de responsáveis e convites de ativação.
 */
const crypto = require('crypto');
const { maskCpf, digestCode } = require('../utils/validation');

function guardianInvitationView(invitation) {
  return {
    id: invitation.id,
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    relationship: invitation.relationship,
    cpfMasked: maskCpf(invitation.cpf),
    studentIds: invitation.studentIds,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
  };
}

function issueGuardianInvitation(database, guardian, studentId) {
  database.guardianInvitations ||= [];

  const pending = database.guardianInvitations.find(
    (item) => item.email === guardian.email && item.status === 'PENDENTE',
  );

  const code = crypto.randomBytes(12).toString('hex').toUpperCase();
  const invitation = pending || {
    id: crypto.randomUUID(),
    email: guardian.email,
    studentIds: [],
    status: 'PENDENTE',
  };

  Object.assign(invitation, {
    name: guardian.name,
    phone: guardian.phone,
    relationship: guardian.relationship,
    cpf: guardian.cpf || invitation.cpf || '',
    codeHash: digestCode(code),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });

  invitation.studentIds = [...new Set([...invitation.studentIds, studentId])];
  if (!pending) database.guardianInvitations.push(invitation);

  return {
    invitation: guardianInvitationView(invitation),
    activationCode: code,
  };
}

module.exports = { guardianInvitationView, issueGuardianInvitation };
