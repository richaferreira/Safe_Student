# Modelo de Dados SQLite — Safe Student

Este documento resume o banco relacional usado pelo MVP após a migração do arquivo JSON.

## Entidades principais

### `school`
Armazena os dados básicos da escola utilizada na demonstração.

### `users`
Armazena as contas de Gestão, Portaria e Responsável.

Campos relevantes:

- `id`: identificador;
- `name`: nome;
- `email`: único;
- `cpf`: único quando informado;
- `password_hash`: senha protegida por hash;
- `role`: `GESTAO`, `PORTARIA` ou `RESPONSAVEL`;
- `status`: `ATIVO` ou `INATIVO`.

### `classes`
Representa as turmas disponíveis para matrícula.

### `students`
Armazena alunos, matrícula, turma, token de Portaria e situação cadastral.

A matrícula e o token possuem restrição de unicidade no próprio banco.

## Relacionamento responsável x aluno

### `guardian_students`
Tabela associativa N:N.

```text
users                    students
   1                         1
   |                         |
   N                         N
    \                       /
     guardian_students
```

A chave primária composta impede cadastrar duas vezes o mesmo vínculo.

## Operação da Portaria

### `attendance`
Registra cada ENTRADA ou SAÍDA.

Relacionamentos:

- `student_id` → aluno;
- `registered_by` → usuário que realizou o registro.

Existe índice por aluno e data/hora para acelerar o histórico individual.

## Comunicação

### `notifications`
Armazena notificações internas destinadas a um usuário e, quando aplicável, relacionadas a um aluno.

### `messages`
Registra mensagens entre dois usuários autorizados.

## Auditoria

### `audit_log`
Registra ações importantes do sistema.

O campo `user_id` é preservado como identificador histórico e não exige que a conta continue existindo no momento da leitura do log.

## Validação acadêmica

### `feedback`
Mantém avaliações usadas na validação do MVP, com cenário, sucesso, tempo, nota e comentário.

## Convites de responsáveis

### `guardian_invitations`
Armazena o convite, prazo, status e hash do código de ativação.

### `guardian_invitation_students`
Relaciona um convite a um ou mais alunos. A separação evita armazenar listas de IDs dentro de uma coluna JSON.

## Controle do schema

### `schema_migrations`
Registra quais arquivos de migration já foram aplicados.

O primeiro schema está em:

```text
src/database/migrations/001_initial_schema.sql
```

## Preparação para um banco futuro

O modelo usa tipos e relacionamentos simples que podem ser traduzidos para PostgreSQL ou MySQL com poucas alterações conceituais. Os principais ajustes futuros seriam na sintaxe das migrations, na biblioteca de conexão e nos repositories.
