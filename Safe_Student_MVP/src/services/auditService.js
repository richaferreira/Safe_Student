/**
 * Registro de auditoria das operações importantes do sistema.
 */
const crypto = require('crypto');

function addAudit(database, userId, action, entity = '', entityId = '', details = '') {
  database.audit ||= [];
  database.audit.push({
    id: crypto.randomUUID(),
    userId,
    action,
    entity,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { addAudit };
