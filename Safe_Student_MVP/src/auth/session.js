/**
 * Controle de sessão, cookie e limitação básica de tentativas de login.
 */
const { config } = require('../config');
const { sessions, loginAttempts } = require('./state');

function safeUser(user) {
  const safe = { ...user };
  delete safe.passwordHash;
  return safe;
}

function bearerToken(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function authToken(req) {
  return bearerToken(req) || cookieValue(req, 'ss_session');
}

function setSessionCookie(res, token, maxAgeSeconds = Math.floor(config.sessionTtlMs / 1000)) {
  res.setHeader(
    'Set-Cookie',
    `ss_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'ss_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
}

function userFromRequest(req, database) {
  const token = authToken(req);
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  // Revalidamos o usuário em cada requisição para refletir vínculos e acessos revogados.
  const current = database.users.find(
    (item) => item.id === session.user.id && item.status === 'ATIVO',
  );

  if (!current) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + config.sessionTtlMs;
  session.user = safeUser(current);
  return session.user;
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter((time) => now - time < 60_000);
  loginAttempts.set(ip, attempts);
  return attempts.length >= 10;
}

function recordLoginAttempt(ip) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

module.exports = {
  safeUser,
  authToken,
  setSessionCookie,
  clearSessionCookie,
  userFromRequest,
  isRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
};
