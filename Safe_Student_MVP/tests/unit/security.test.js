/**
 * Testes unitários do Safe Student.
 *
 * Os cenários estão escritos em PT-BR para manter a entrega acadêmica coerente
 * com a documentação e facilitar a apresentação do projeto.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashPassword, verifyPassword, randomToken
}
= require('../../src/services/security');
test('hash e verificação de senha', () => {
  const h = hashPassword('demo123', '0123456789abcdef'); assert.equal(verifyPassword('demo123', h), true); assert.equal(verifyPassword('errada', h), false);
});
test('hash inválido falha com segurança', () => {
  assert.equal(verifyPassword('demo123', 'salt:zzzz'), false); assert.equal(verifyPassword('demo123', ''), false);
});
test('token aleatório possui entropia e tamanho esperado', () => {
  const a = randomToken(24); const b = randomToken(24); assert.equal(a.length, 48); assert.equal(b.length, 48); assert.notEqual(a, b);
});
