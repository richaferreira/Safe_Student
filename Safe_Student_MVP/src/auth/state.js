/**
 * Estado temporário mantido em memória no MVP acadêmico.
 *
 * Em produção, sessões e redefinições de senha precisariam de armazenamento
 * persistente/distribuído. Aqui o objetivo é manter a demonstração simples.
 */
const sessions = new Map();
const loginAttempts = new Map();
const passwordResets = new Map();

module.exports = { sessions, loginAttempts, passwordResets };
