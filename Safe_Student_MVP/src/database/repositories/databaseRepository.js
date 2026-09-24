/**
 * Repositório relacional do banco inteiro.
 *
 * O MVP já possui serviços que trabalham com um objeto agregado (school, users,
 * students etc.). Para realizar a migração sem reescrever todas as regras de
 * negócio de uma vez, este repositório converte as tabelas relacionais para esse
 * formato e também faz o caminho inverso dentro de uma transação.
 *
 * Essa decisão funciona como uma camada de compatibilidade. Em uma evolução
 * futura, cada serviço pode passar a consultar seu próprio repository sem mudar
 * as telas ou as regras já validadas.
 */

function rowOrNull(statement) {
  return statement.get() || null;
}

function loadAggregate(database) {
  const school = rowOrNull(database.prepare('SELECT id, name, city, mode FROM school LIMIT 1'));

  const guardianLinks = database.prepare(
    'SELECT guardian_id, student_id FROM guardian_students ORDER BY guardian_id, student_id',
  ).all();
  const studentsByGuardian = new Map();
  for (const link of guardianLinks) {
    const list = studentsByGuardian.get(link.guardian_id) || [];
    list.push(link.student_id);
    studentsByGuardian.set(link.guardian_id, list);
  }

  const users = database.prepare(`
    SELECT id, name, email, phone, cpf, password_hash, role, status
    FROM users ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.cpf ? { cpf: row.cpf } : {}),
    passwordHash: row.password_hash,
    role: row.role,
    studentIds: studentsByGuardian.get(row.id) || [],
    status: row.status,
  }));

  const classes = database.prepare(
    'SELECT id, name, shift FROM classes ORDER BY rowid',
  ).all();

  const students = database.prepare(`
    SELECT id, name, enrollment, class_id, token, status
    FROM students ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    enrollment: row.enrollment,
    classId: row.class_id,
    token: row.token,
    status: row.status,
  }));

  const attendance = database.prepare(`
    SELECT id, student_id, type, method, timestamp, registered_by, origin
    FROM attendance ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    ...(row.method ? { method: row.method } : {}),
    timestamp: row.timestamp,
    ...(row.registered_by ? { registeredBy: row.registered_by } : {}),
    ...(row.origin ? { origin: row.origin } : {}),
  }));

  const notifications = database.prepare(`
    SELECT id, user_id, student_id, title, message, created_at, is_read, severity
    FROM notifications ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    userId: row.user_id,
    ...(row.student_id ? { studentId: row.student_id } : {}),
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    read: Boolean(row.is_read),
    ...(row.severity ? { severity: row.severity } : {}),
  }));

  const messages = database.prepare(`
    SELECT id, from_user_id, to_user_id, text, created_at
    FROM messages ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    text: row.text,
    createdAt: row.created_at,
  }));

  const audit = database.prepare(`
    SELECT id, user_id, action, entity, entity_id, details, created_at
    FROM audit_log ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    ...(row.user_id ? { userId: row.user_id } : {}),
    action: row.action,
    ...(row.entity ? { entity: row.entity } : {}),
    entityId: row.entity_id || '',
    details: row.details || '',
    createdAt: row.created_at,
  }));

  const feedback = database.prepare(`
    SELECT id, user_id, profile, scenario, success, time_seconds, score, comment, source, created_at
    FROM feedback ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    ...(row.user_id ? { userId: row.user_id } : {}),
    profile: row.profile,
    ...(row.scenario ? { scenario: row.scenario } : {}),
    ...(row.success === null || row.success === undefined ? {} : { success: Boolean(row.success) }),
    ...(row.time_seconds === null || row.time_seconds === undefined ? {} : { timeSeconds: Number(row.time_seconds) }),
    score: Number(row.score),
    comment: row.comment || '',
    ...(row.source ? { source: row.source } : {}),
    createdAt: row.created_at,
  }));

  const invitationLinks = database.prepare(`
    SELECT invitation_id, student_id
    FROM guardian_invitation_students
    ORDER BY invitation_id, student_id
  `).all();
  const studentsByInvitation = new Map();
  for (const link of invitationLinks) {
    const list = studentsByInvitation.get(link.invitation_id) || [];
    list.push(link.student_id);
    studentsByInvitation.set(link.invitation_id, list);
  }

  const guardianInvitations = database.prepare(`
    SELECT id, name, email, phone, cpf, relationship, status, code_hash, expires_at
    FROM guardian_invitations ORDER BY rowid
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    ...(row.cpf ? { cpf: row.cpf } : {}),
    relationship: row.relationship || '',
    studentIds: studentsByInvitation.get(row.id) || [],
    status: row.status,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
  }));

  return {
    school: school || {},
    users,
    classes,
    students,
    attendance,
    notifications,
    messages,
    audit,
    feedback,
    guardianInvitations,
  };
}

function replaceAggregate(database, aggregate) {
  database.exec('BEGIN IMMEDIATE;');
  try {
    // Apaga primeiro as tabelas filhas para respeitar as chaves estrangeiras.
    for (const table of [
      'guardian_invitation_students',
      'guardian_students',
      'notifications',
      'messages',
      'attendance',
      'audit_log',
      'feedback',
      'guardian_invitations',
      'students',
      'classes',
      'users',
      'school',
    ]) {
      database.exec(`DELETE FROM ${table};`);
    }

    if (aggregate.school?.id) {
      database.prepare('INSERT INTO school(id, name, city, mode) VALUES (?, ?, ?, ?)').run(
        aggregate.school.id,
        aggregate.school.name,
        aggregate.school.city,
        aggregate.school.mode,
      );
    }

    const insertUser = database.prepare(`
      INSERT INTO users(id, name, email, phone, cpf, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of aggregate.users || []) {
      insertUser.run(
        user.id,
        user.name,
        user.email,
        user.phone || null,
        user.cpf || null,
        user.passwordHash,
        user.role,
        user.status,
      );
    }

    const insertClass = database.prepare('INSERT INTO classes(id, name, shift) VALUES (?, ?, ?)');
    for (const schoolClass of aggregate.classes || []) {
      insertClass.run(schoolClass.id, schoolClass.name, schoolClass.shift);
    }

    const insertStudent = database.prepare(`
      INSERT INTO students(id, name, enrollment, class_id, token, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const student of aggregate.students || []) {
      insertStudent.run(student.id, student.name, student.enrollment, student.classId, student.token, student.status);
    }

    const insertGuardianStudent = database.prepare(`
      INSERT INTO guardian_students(guardian_id, student_id) VALUES (?, ?)
    `);
    for (const user of aggregate.users || []) {
      if (user.role !== 'RESPONSAVEL') continue;
      for (const studentId of [...new Set(user.studentIds || [])]) {
        insertGuardianStudent.run(user.id, studentId);
      }
    }

    const insertAttendance = database.prepare(`
      INSERT INTO attendance(id, student_id, type, method, timestamp, registered_by, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const record of aggregate.attendance || []) {
      insertAttendance.run(
        record.id,
        record.studentId,
        record.type,
        record.method || null,
        record.timestamp,
        record.registeredBy || null,
        record.origin || null,
      );
    }

    const insertNotification = database.prepare(`
      INSERT INTO notifications(id, user_id, student_id, title, message, created_at, is_read, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of aggregate.notifications || []) {
      insertNotification.run(
        item.id,
        item.userId,
        item.studentId || null,
        item.title,
        item.message,
        item.createdAt,
        item.read ? 1 : 0,
        item.severity || null,
      );
    }

    const insertMessage = database.prepare(`
      INSERT INTO messages(id, from_user_id, to_user_id, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of aggregate.messages || []) {
      insertMessage.run(item.id, item.fromUserId, item.toUserId, item.text, item.createdAt);
    }

    const insertAudit = database.prepare(`
      INSERT INTO audit_log(id, user_id, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of aggregate.audit || []) {
      insertAudit.run(
        item.id,
        item.userId || null,
        item.action,
        item.entity || null,
        item.entityId || '',
        item.details || '',
        item.createdAt,
      );
    }

    const insertFeedback = database.prepare(`
      INSERT INTO feedback(id, user_id, profile, scenario, success, time_seconds, score, comment, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of aggregate.feedback || []) {
      insertFeedback.run(
        item.id,
        item.userId || null,
        item.profile,
        item.scenario || null,
        typeof item.success === 'boolean' ? (item.success ? 1 : 0) : null,
        Number.isFinite(Number(item.timeSeconds)) ? Number(item.timeSeconds) : null,
        item.score,
        item.comment || '',
        item.source || null,
        item.createdAt,
      );
    }

    const insertInvitation = database.prepare(`
      INSERT INTO guardian_invitations(id, name, email, phone, cpf, relationship, status, code_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInvitationStudent = database.prepare(`
      INSERT INTO guardian_invitation_students(invitation_id, student_id) VALUES (?, ?)
    `);
    for (const item of aggregate.guardianInvitations || []) {
      insertInvitation.run(
        item.id,
        item.name,
        item.email,
        item.phone || null,
        item.cpf || null,
        item.relationship || null,
        item.status,
        item.codeHash || null,
        item.expiresAt,
      );
      for (const studentId of [...new Set(item.studentIds || [])]) {
        insertInvitationStudent.run(item.id, studentId);
      }
    }

    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

module.exports = { loadAggregate, replaceAggregate };
