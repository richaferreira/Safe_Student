-- Estrutura inicial do banco relacional do Safe Student.
-- O objetivo é manter o MVP simples para demonstração, mas com integridade
-- referencial suficiente para permitir futura migração para PostgreSQL/MySQL.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  mode TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  cpf TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('GESTAO', 'PORTARIA', 'RESPONSAVEL')),
  status TEXT NOT NULL CHECK (status IN ('ATIVO', 'INATIVO'))
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shift TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enrollment TEXT NOT NULL UNIQUE,
  class_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ATIVO', 'INATIVO')),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS guardian_students (
  guardian_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  PRIMARY KEY (guardian_id, student_id),
  FOREIGN KEY (guardian_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA')),
  method TEXT,
  timestamp TEXT NOT NULL,
  registered_by TEXT,
  origin TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (registered_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  student_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  severity TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  profile TEXT NOT NULL,
  scenario TEXT,
  success INTEGER CHECK (success IN (0, 1)),
  time_seconds INTEGER,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS guardian_invitations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  cpf TEXT,
  relationship TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'UTILIZADO', 'REVOGADO')),
  code_hash TEXT,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guardian_invitation_students (
  invitation_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  PRIMARY KEY (invitation_id, student_id),
  FOREIGN KEY (invitation_id) REFERENCES guardian_invitations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_guardian_students_student_id ON guardian_students(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_timestamp ON attendance(student_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from_created ON messages(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to_created ON messages(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_email_status ON guardian_invitations(email, status);
