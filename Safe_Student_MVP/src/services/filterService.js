/**
 * Leitura e validação dos filtros usados em relatórios e histórico do aluno.
 */
const { sendJson } = require('../http/response');
const { dateKey } = require('../utils/dateTime');

function reportFilters(url, database, res) {
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const classId = url.searchParams.get('classId') || '';
  const studentId = url.searchParams.get('studentId') || '';
  const type = String(url.searchParams.get('type') || '').toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  const validDate = (value) =>
    !value ||
    (isoDate.test(value) &&
      !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);

  const invalid =
    !validDate(from) ||
    !validDate(to) ||
    (from && to && from > to) ||
    (classId && !database.classes.some((item) => item.id === classId)) ||
    (studentId && !database.students.some((item) => item.id === studentId)) ||
    (type && !['ENTRADA', 'SAIDA'].includes(type));

  if (invalid) {
    sendJson(res, 400, {
      error: 'Filtros inválidos: confira período, turma, aluno e tipo de movimentação.',
    });
    return null;
  }

  return {
    classId,
    studentId,
    type,
    from,
    to,
    inRange(timestamp) {
      const key = dateKey(timestamp);
      return (!from || key >= from) && (!to || key <= to);
    },
  };
}

function studentProfileFilters(url, res) {
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const type = String(url.searchParams.get('type') || '').toUpperCase();
  const query = String(url.searchParams.get('q') || '')
    .trim()
    .toLocaleLowerCase('pt-BR');
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  const invalid =
    (from && !isoDate.test(from)) ||
    (to && !isoDate.test(to)) ||
    (from && to && from > to) ||
    (type && !['ENTRADA', 'SAIDA'].includes(type)) ||
    query.length > 120;

  if (invalid) {
    sendJson(res, 400, { error: 'Filtros do histórico inválidos.' });
    return null;
  }

  return {
    from,
    to,
    type,
    q: query,
    inRange(timestamp) {
      const key = dateKey(timestamp);
      return (!from || key >= from) && (!to || key <= to);
    },
  };
}

module.exports = { reportFilters, studentProfileFilters };
