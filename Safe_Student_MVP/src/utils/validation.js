/**
 * Validações simples utilizadas nos cadastros do MVP.
 */
const crypto = require('crypto');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpf(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false;

  // CPFs com todos os números iguais não são válidos.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += digits[index] * (10 - index);
  }

  let remainder = sum % 11;
  const firstVerifier = remainder < 2 ? 0 : 11 - remainder;
  if (firstVerifier !== digits[9]) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += digits[index] * (11 - index);
  }

  remainder = sum % 11;
  const secondVerifier = remainder < 2 ? 0 : 11 - remainder;
  return secondVerifier === digits[10];
}

function maskCpf(cpf) {
  return cpf && cpf.length === 11
    ? `***.***.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`
    : '';
}

function digestCode(value) {
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toUpperCase())
    .digest('hex');
}

function isValidPersonName(value) {
  return value.length >= 3 && value.length <= 120 && !/[<>]/.test(value);
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  normalizeCpf,
  isValidCpf,
  maskCpf,
  digestCode,
  isValidPersonName,
};
