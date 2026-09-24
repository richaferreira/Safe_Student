/**
 * Datas do sistema sempre consideram o fuso configurado para a escola.
 */
const { config } = require('../config');

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function formatSchoolDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: config.timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

module.exports = { dateKey, formatSchoolDateTime };
