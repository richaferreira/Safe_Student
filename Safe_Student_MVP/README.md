# Safe Student — MVP Acadêmico com SQLite

O **Safe Student** é um MVP acadêmico de Engenharia de Software voltado ao controle de movimentações escolares, vínculo entre alunos e responsáveis, comunicação, notificações, relatórios e auditoria.

Nesta evolução, a persistência mutável deixou de usar arquivo JSON e passou a utilizar **SQLite relacional**. O frontend, as regras de negócio e os fluxos de Gestão, Portaria e Responsável foram preservados. A mudança foi concentrada na camada de persistência para facilitar uma migração futura para PostgreSQL ou MySQL.

## Requisito

- **Node.js 22.13 ou superior**.
- Não é necessário instalar MySQL, PostgreSQL, Docker ou pacotes npm externos.
- O projeto usa `node:sqlite`, disponível no próprio Node.js moderno.

## Como executar

No terminal, dentro da pasta do projeto:

```powershell
npm test
npm start
```

Depois acesse:

```text
http://localhost:3000
```

Na primeira inicialização, o sistema cria automaticamente `data/safe_student.db`, aplica as migrations e carrega o seed fictício quando o banco estiver vazio.

## Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Gestão | gestor@demo.com | demo123 |
| Portaria | portaria@demo.com | demo123 |
| Responsável | responsavel@demo.com | demo123 |

## Estrutura do projeto

```text
Safe_Student_MVP_SQLite/
├── data/
│   ├── db.seed.json              # Dados fictícios usados pelo seed
│   └── safe_student.db           # Gerado localmente; não precisa ir ao Git
├── docs/
├── public/                       # Frontend
├── scripts/
│   ├── db-migrate.js
│   ├── db-seed.js
│   ├── db-reset.js
│   ├── db-status.js
│   └── migrate-json-to-sqlite.js
├── src/
│   ├── auth/
│   ├── config/
│   ├── database/
│   │   ├── connection.js
│   │   ├── migrationRunner.js
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql
│   │   ├── repositories/
│   │   │   └── databaseRepository.js
│   │   └── repository.js
│   ├── http/
│   ├── services/
│   ├── utils/
│   └── app.js
├── tests/
│   ├── unit/
│   └── integration/
├── server.js
└── package.json
```

## Modelo relacional

As principais tabelas são:

```text
users
students
classes
guardian_students
attendance
notifications
messages
audit_log
feedback
guardian_invitations
guardian_invitation_students
```

O relacionamento entre responsáveis e alunos é N:N:

```text
users (RESPONSAVEL)
        │
        │ 1..N
        ▼
guardian_students
        ▲
        │ 1..N
        │
students
```

Isso permite que um responsável possua vários filhos e que um aluno tenha vários responsáveis autorizados.

## Integridade adicionada pelo SQLite

A persistência agora utiliza:

- `PRIMARY KEY` para os identificadores;
- `UNIQUE` para e-mail, matrícula e token do aluno;
- `FOREIGN KEY` para os relacionamentos principais;
- `CHECK` para perfis, status e tipos de movimentação;
- índices para consultas frequentes;
- transações com `BEGIN IMMEDIATE`, `COMMIT` e `ROLLBACK`;
- WAL (`journal_mode = WAL`) para melhorar a segurança da gravação local.

## Por que existe uma camada de compatibilidade

Os serviços atuais já estavam validados e trabalham com um objeto agregado contendo alunos, usuários, movimentações e demais dados. Para evitar uma reescrita arriscada, `src/database/repositories/databaseRepository.js` converte as tabelas SQLite para esse formato e grava o agregado novamente dentro de **uma única transação**.

Essa abordagem permite migrar o armazenamento agora sem quebrar as regras existentes. Em uma evolução futura, os serviços podem ser migrados gradualmente para repositories específicos e consultas SQL direcionadas.

## Comandos do banco

Aplicar migrations:

```powershell
npm run db:migrate
```

Carregar novamente o seed fictício:

```powershell
npm run db:seed
```

Apagar o banco local, recriar schema e restaurar a demonstração:

```powershell
npm run db:reset
```

Ver um resumo das tabelas:

```powershell
npm run db:status
```

Importar uma base JSON antiga:

```powershell
npm run db:import-json -- caminho\para\db.runtime.json
```

## Testes

A suíte atual executa **68 testes**:

```powershell
npm test
```

Além dos testes funcionais existentes, foram acrescentados testes específicos para SQLite, incluindo:

- criação das tabelas pelas migrations;
- seed de demonstração;
- matrícula duplicada bloqueada por `UNIQUE`;
- vínculo inválido bloqueado por `FOREIGN KEY`;
- rollback da transação quando uma gravação falha;
- confirmação de que o arquivo gerado é um banco SQLite real.

## Migração futura para PostgreSQL/MySQL

A aplicação não acessa o arquivo SQLite diretamente pelas telas ou serviços de domínio. O acesso fica isolado em `src/database`.

A evolução esperada é:

```text
Frontend
   ↓
API
   ↓
Services
   ↓
Repository
   ↓
SQLite
```

Futuramente:

```text
Frontend
   ↓
API
   ↓
Services
   ↓
Repository
   ↓
PostgreSQL ou MySQL
```

Portanto, a troca futura deve ficar concentrada principalmente na conexão, migrations e repositories, sem exigir reconstrução do frontend ou das regras de Gestão, Portaria e Responsável.

## Limites do MVP

O banco agora é relacional, porém o projeto continua sendo um **MVP acadêmico**. As sessões e códigos temporários ainda ficam em memória, e não existe infraestrutura de produção, cluster, alta disponibilidade, envio real de e-mail ou homologação para dados reais de crianças e adolescentes.

Use somente dados fictícios na apresentação.

Leia também `docs/MIGRACAO_SQLITE.md` e `docs/GUIA_ESTRUTURA_CODIGO.md`.
