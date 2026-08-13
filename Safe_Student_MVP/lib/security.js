const crypto = require('crypto');
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const exp = Buffer.from(expected, 'hex');
  return exp.length === actual.length && crypto.timingSafeEqual(exp, actual);
}
function randomToken(bytes = 24) { return crypto.randomBytes(bytes).toString('hex'); }
module.exports = { hashPassword, verifyPassword, randomToken };
