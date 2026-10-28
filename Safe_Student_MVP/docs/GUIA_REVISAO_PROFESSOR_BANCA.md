# Guia de Revisão de Engenharia de Software, UML e DER para a Banca
## Safe Student — Alinhamento Integral com as Orientações do Professor

Este documento detalha as decisões de modelagem, casos de uso, diagrama entidade-relacionamento (DER) e persistência relacional SQLite do Safe Student, consolidando as correções solicitadas na revisão com o orientador.

---

## 1. Correções no Diagrama de Casos de Uso (UML 2.5)

### Regras Fundamentais Exigidas pelo Professor:
1. **Casos de uso NUNCA se comunicam diretamente através de associação simples (linha sólida).** Linhas sólidas conectam apenas **Atores aos Casos de Uso**.
2. **Entre Casos de Uso existem apenas três formas válidas de relacionamento:**
   - **`<<include>>` (Inclusão Obrigatória):** Representado por linha tracejada com seta aberta apontando na direção do caso de uso incluído (`Caso Base` --`<<include>>`--> `Caso Incluído`). O fluxo do caso base só é concluído se o caso incluído for executado.
   - **`<<extend>>` (Extensão Condicional/Opcional):** Representado por linha tracejada com seta aberta apontando na direção do caso de uso base (`Caso Extensão` --`<<extend>>`--> `Caso Base`). Ocorre sob uma condição específica.
   - **Generalização / Especialização (Herança):** Linha sólida com uma seta triangular fechada/vazada apontando para o caso de uso pai/genérico. Representa variantes reais de execução de um mesmo objetivo.

### Mapeamento dos Casos de Uso do Safe Student:

```text
===================================================================================
                         MODELO DE CASOS DE USO UML
===================================================================================

[ Ator: Gestão Escolar ]
   │
   ├─► ( UC01: Gerenciar Turmas )
   │      - Cadastrar turma (Nome, Turno, Status)
   │      - Ativar / Inativar turma
   │
   └─► ( UC02: Cadastrar Aluno )
          │
          ├── <<include>> ──► ( UC01a: Selecionar Turma Ativa )
          │                   [A turma deve existir previamente no banco SQLite]
          │
          └── <<include>> ──► ( UC03: Validar e Vincular Responsáveis )
                                 │  [Mínimo de 1 responsável validado]
                                 │
                                 ▲
                                 │ <<extend>> [Condição: Responsável sem conta ativa]
                                 │
                              ( UC04: Emitir Convite de Ativação com Token )


[ Ator: Operador de Portaria ]
   │
   └─► ( UC05: Registrar Presença Escolar )  [Caso Base Abstrato]
          │
          ├── <<include>> ──► ( UC06: Validar Próxima Ação Operacional )
          │                   [Impede entrada dupla ou saída sem entrada prévia]
          │
          ├── <<include>> ──► ( UC07: Disparar Notificação ao Responsável )
          │                   [Auditoria e aviso gerados atomicamente]
          │
          ▲
         / \  [Generalização: Triângulo vazado apontando para o caso base]
        /   \
       /     \
  ( UC05a:     ( UC05b:
    Registrar    Registrar
    via QR       via Token
    Code )       Manual )


[ Ator: Responsável ]
   │
   ├─► ( UC08: Acompanhar Presença dos Filhos )
   │      [Restrito exclusivamente aos estudantes sob sua tutela via RBAC]
   │
   ├─► ( UC09: Consultar Notificações em Tempo Real )
   │
   └─► ( UC10: Trocar Mensagens Internas com a Escola )
```

---

## 2. Ciclo de Vida e Gerenciamento de Turmas (Classes)

Conforme observado pelo professor:
> *"Se o aluno é obrigado a ter uma turma, então a turma tem que existir antes. Quem cadastra essas turmas? A gestão escolar!"*

### Resolução Implementada:
1. **Módulo de Turmas na Interface:**
   - Tela dedicada acessível pela **Gestão Escolar** no menu lateral (`Turmas`).
   - Tabela exibindo: Nome da Turma, Turno (`Manhã`, `Tarde`, `Noite`, `Integral`), Contagem de Estudantes Ativos e Situação (`ATIVO` / `INATIVO`).
   - Botão **"+ Nova Turma"** para cadastro imediato.
   - Ações de **Editar**, **Ativar/Desativar** e **Excluir**.
   - Atalho rápido **"+ Nova turma"** diretamente dentro do formulário de matrícula de aluno.

2. **Integridade Referencial (Chave Estrangeira):**
   - A tabela `students` possui:
     ```sql
     FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT
     ```
   - O SQLite impede a exclusão física de uma turma que tenha alunos vinculados (`RESTRICT`). A interface alerta a Gestão e orienta a inativar a turma (`status = 'INATIVO'`), preservando o histórico escolar e a integridade relacional.

---

## 3. Modelo Físico de Dados Relacional (SQLite)

O banco é executado via módulo nativo `node:sqlite` do Node.js (sem dependências compiladas nativas externas). As migrations automáticas estão em `src/database/migrations/`.

### Dicionário de Tabelas e Atributos:

1. **`school`**: Dados da unidade de ensino.
   - `id` (PK), `name`, `city`, `mode`.

2. **`users`**: Contas institucionais e responsáveis familiares.
   - `id` (PK), `name`, `email` (UNIQUE), `phone`, `cpf` (UNIQUE), `password_hash`, `role` (CHECK: GESTAO, PORTARIA, RESPONSAVEL), `status` (CHECK: ATIVO, INATIVO).

3. **`classes`**: Turmas cadastradas pela Gestão.
   - `id` (PK), `name` (UNIQUE), `shift` (Turno), `status` (CHECK: ATIVO, INATIVO).

4. **`students`**: Estudantes matriculados.
   - `id` (PK), `name`, `enrollment` (UNIQUE), `class_id` (FK &rarr; `classes.id`), `token` (UNIQUE), `status` (CHECK: ATIVO, INATIVO).

5. **`guardian_students`**: Tabela associativa N:N entre responsáveis e alunos.
   - `guardian_id` (PK, FK &rarr; `users.id`), `student_id` (PK, FK &rarr; `students.id`).

6. **`attendance`**: Registros operacionais de entrada e saída.
   - `id` (PK), `student_id` (FK &rarr; `students.id`), `type` (CHECK: ENTRADA, SAIDA), `method` (TOKEN_MANUAL, QR_CAMERA), `timestamp`, `registered_by` (FK &rarr; `users.id`), `origin`.

7. **`notifications`**: Notificações automáticas aos responsáveis.
   - `id` (PK), `user_id` (FK &rarr; `users.id`), `student_id` (FK), `title`, `message`, `created_at`, `is_read` (0 ou 1), `severity`.

8. **`guardian_invitations`**: Convites com código temporário para ativação de novos responsáveis.
   - `id` (PK), `name`, `email`, `phone`, `cpf`, `relationship`, `status` (CHECK: PENDENTE, UTILIZADO, REVOGADO), `code_hash`, `expires_at`.

9. **`audit_log`**: Trilha de auditoria administrativa e de segurança.
   - `id` (PK), `user_id`, `action`, `entity`, `entity_id`, `details`, `created_at`.

---

## 4. Guia Rápido: "Como Adicionar um Atributo ao Vivo" na Banca

Se durante a apresentação o professor pedir:
> *"Adiciona um atributo nessa classe aqui, dentro do código e dentro do banco de dados ao vivo, sem assistente."*

Siga este roteiro de 4 passos com segurança:

### Exemplo: Adicionar o atributo `classroom` (Sala) na turma `classes`

#### Passo 1: No Banco SQLite (Migration)
Abra a pasta `src/database/migrations/` ou crie `003_add_classroom_to_classes.sql`:
```sql
ALTER TABLE classes ADD COLUMN classroom TEXT;
```

#### Passo 2: No Repositório (`src/database/repositories/databaseRepository.js`)
- Em `loadAggregate(database)`:
  Adicione `classroom` na query:
  ```javascript
  SELECT id, name, shift, status, classroom FROM classes ORDER BY rowid
  ```
  E no mapeamento do objeto:
  ```javascript
  classroom: row.classroom || '',
  ```
- Em `replaceAggregate(database, aggregate)`:
  Altere o `insertClass`:
  ```javascript
  const insertClass = database.prepare('INSERT INTO classes(id, name, shift, status, classroom) VALUES (?, ?, ?, ?, ?)');
  insertClass.run(schoolClass.id, schoolClass.name, schoolClass.shift, schoolClass.status || 'ATIVO', schoolClass.classroom || null);
  ```

#### Passo 3: Na API HTTP (`src/app.js`)
- No `POST /api/classes`:
  ```javascript
  const classroom = String(body.classroom || '').trim();
  const newClass = { id: ..., name, shift, status, classroom };
  ```
- No `PATCH /api/classes/:id`:
  ```javascript
  if (body.classroom !== undefined) schoolClass.classroom = String(body.classroom || '').trim();
  ```

#### Passo 4: No Frontend (`public/js/views/classes.js` e `public/index.html`)
- No `index.html`: adicione o campo no formulário:
  ```html
  <label>Sala<input id="classFormRoom" placeholder="Ex.: Sala 12" /></label>
  ```
- Em `classes.js`:
  - Ao abrir o form: `$('classFormRoom').value = classItem?.classroom || '';`
  - Ao salvar: envie `classroom: $('classFormRoom').value` no `JSON.stringify`.
  - Na tabela: adicione `<th>Sala</th>` e `<td>${escapeHtml(c.classroom || '—')}</td>`.

Pronto! O atributo existirá no banco relacional SQLite, no repositório, na API REST e na interface de usuário.
