from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: esperado 1 trecho, encontrado {count}")
    return text.replace(old, new, 1)


server_path = Path('Safe_Student_MVP/server.js')
text = server_path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "const DB_PATH = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.json');",
    "const SEED_DB_PATH = path.join(__dirname, 'data', 'db.seed.json');\nconst DB_PATH = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.runtime.json');",
    'caminho do banco',
)

text = replace_once(
    text,
    "function readDb() {\n  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));\n}",
    "function ensureDb() {\n  if (!fs.existsSync(DB_PATH)) fs.copyFileSync(SEED_DB_PATH, DB_PATH);\n}\n\nfunction readDb() {\n  ensureDb();\n  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));\n}",
    'inicialização do banco',
)

text = replace_once(
    text,
    "function safeUser(user) {\n  const u = { ...user };\n  delete u.passwordHash;\n  return u;\n}",
    "function safeUser(user) {\n  const u = { ...user };\n  delete u.passwordHash;\n  return u;\n}\n\nfunction directoryUser(user) {\n  return { id: user.id, name: user.name, role: user.role, status: user.status };\n}\n\nfunction uniqueStudentToken(db) {\n  for (let i = 0; i < 32; i += 1) {\n    const token = `SS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;\n    if (!db.students.some((s) => s.token === token)) return token;\n  }\n  throw new Error('Não foi possível gerar token único para o aluno.');\n}",
    'projeção de diretório e token único',
)

text = replace_once(
    text,
    "function visibleDirectory(user, db) {\n  return db.users.filter((u) => canMessageUser(user, u)).map(safeUser);\n}",
    "function visibleDirectory(user, db) {\n  return db.users.filter((u) => canMessageUser(user, u)).map(directoryUser);\n}",
    'diretório mínimo',
)

text = replace_once(
    text,
    ".filter((n) => n.userId === user.id || ['GESTAO', 'ADMIN'].includes(user.role))",
    ".filter((n) => n.userId === user.id)",
    'escopo de notificações do dashboard',
)

old_guardians = """guardians: db.users
            .filter((u) => (u.studentIds || []).includes(s.id))
            .map((u) => ({ id: u.id, name: u.name, email: u.email })),"""
new_guardians = """guardians: canManageSchool(user.role)
            ? db.users
              .filter((u) => (u.studentIds || []).includes(s.id))
              .map((u) => ({ id: u.id, name: u.name }))
            : [],"""
text = replace_once(text, old_guardians, new_guardians, 'minimização de responsáveis em /api/students')

text = replace_once(
    text,
    "const token = `SS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;",
    "const token = uniqueStudentToken(db);",
    'unicidade de token',
)

text = replace_once(
    text,
    "taxaDemo: attendanceRate(rec, 20),",
    "taxaDemo: attendanceRate(rec, 20, dateKey),",
    'taxa por dia escolar',
)

text = replace_once(
    text,
    ".filter((m) => m.fromUserId === user.id || m.toUserId === user.id || ['GESTAO', 'ADMIN'].includes(user.role))",
    ".filter((m) => m.fromUserId === user.id || m.toUserId === user.id)",
    'privacidade das mensagens',
)

text = replace_once(
    text,
    "(db.feedback || []).forEach((f) => rows.push([",
    "(db.feedback || []).filter((f) => f.source === 'APRESENTACAO').forEach((f) => rows.push([",
    'exportação de validação sem seed ilustrativo',
)

old_guardians_endpoint = """guardians: db.users.filter((u) => u.role === 'RESPONSAVEL' && u.status === 'ATIVO').map(safeUser),"""
new_guardians_endpoint = """guardians: db.users
          .filter((u) => u.role === 'RESPONSAVEL' && u.status === 'ATIVO')
          .map((u) => ({ id: u.id, name: u.name })),"""
text = replace_once(text, old_guardians_endpoint, new_guardians_endpoint, 'projeção mínima de responsáveis')

old_reset = """      const original = path.join(__dirname, 'data', 'db.seed.json');
      fs.copyFileSync(original, DB_PATH);
      sessions.clear();
      return json(res, 200, { ok: true, message: 'Demonstração restaurada.' });"""
new_reset = """      fs.copyFileSync(SEED_DB_PATH, DB_PATH);
      const resetDb = readDb();
      audit(resetDb, user.id, 'RESTAURAR_DEMO', 'base_demo', '', 'Base restaurada para o estado inicial.');
      writeDb(resetDb);
      sessions.clear();
      return json(res, 200, { ok: true, message: 'Demonstração restaurada.' });"""
text = replace_once(text, old_reset, new_reset, 'auditoria do reset')

server_path.write_text(text, encoding='utf-8')

reset_path = Path('Safe_Student_MVP/scripts-reset.js')
reset_path.write_text(
    "const fs = require('fs');\n"
    "const path = require('path');\n\n"
    "const seed = path.join(__dirname, 'data', 'db.seed.json');\n"
    "const target = process.env.SS_DB_PATH || path.join(__dirname, 'data', 'db.runtime.json');\n"
    "fs.copyFileSync(seed, target);\n"
    "console.log(`Base de apresentação restaurada em ${target}.`);\n",
    encoding='utf-8',
)

print('Refatoração sênior aplicada com sucesso.')
