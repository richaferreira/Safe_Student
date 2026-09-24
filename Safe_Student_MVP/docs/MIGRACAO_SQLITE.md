# Migração da Persistência JSON para SQLite

## 1. Objetivo

A migração foi realizada para tornar a persistência do Safe Student mais próxima de uma aplicação real sem aumentar desnecessariamente a complexidade da demonstração acadêmica.

O arquivo JSON era adequado para as primeiras validações, porém não oferecia recursos nativos como chaves estrangeiras, restrições de unicidade, índices e transações de banco de dados.

## 2. Estratégia adotada

A regra principal foi **não reescrever funcionalidades que já estavam validadas**.

Antes:

```text
Services → repository.js → db.runtime.json
```

Depois:

```text
Services → repository.js → databaseRepository.js → SQLite
```

O contrato `readDatabase()` / `writeDatabase()` foi preservado. Assim, a migração fica concentrada na infraestrutura e não altera a lógica das telas.

## 3. Normalização das estruturas

O antigo campo `studentIds` de um responsável não foi armazenado como JSON dentro da tabela de usuários. Foi criada a tabela associativa:

```text
guardian_students
- guardian_id
- student_id
```

O mesmo foi feito com os alunos vinculados a convites:

```text
guardian_invitation_students
- invitation_id
- student_id
```

Essa decisão representa corretamente relacionamentos N:N e prepara o projeto para bancos relacionais mais avançados.

## 4. Transações

A gravação do agregado inteiro ocorre dentro de uma transação SQLite:

```text
BEGIN IMMEDIATE
  gravações
COMMIT
```

Quando existe erro de restrição:

```text
ROLLBACK
```

Com isso, uma matrícula com dados inconsistentes não deixa o banco pela metade.

## 5. Integridade

Foram adicionadas restrições para reduzir inconsistências:

- e-mail de usuário único;
- matrícula de aluno única;
- token de aluno único;
- vínculo responsável/aluno sem duplicidade;
- relacionamento por chaves estrangeiras;
- perfil limitado a GESTAO, PORTARIA ou RESPONSAVEL;
- movimentação limitada a ENTRADA ou SAIDA.

## 6. Auditoria

O identificador do ator em `audit_log.user_id` foi mantido como informação histórica e não possui chave estrangeira obrigatória. A razão é permitir preservar a autoria do evento mesmo se uma conta deixar de existir após uma restauração de demonstração ou futura política de retenção.

Essa escolha foi descoberta durante os próprios testes da migração: uma FK obrigatória tornava impossível registrar corretamente o evento de restauração após trocar a base.

## 7. Seed e migrations

O arquivo `data/db.seed.json` continua existindo apenas como **fixture de dados fictícios**. Ele não é mais a base mutável da aplicação.

O banco em execução é:

```text
data/safe_student.db
```

O schema é controlado por arquivos SQL em:

```text
src/database/migrations/
```

## 8. Compatibilidade com uma base JSON antiga

Uma base antiga pode ser importada com:

```powershell
npm run db:import-json -- data\db.runtime.json
```

O script lê o formato anterior e grava os dados nas novas tabelas dentro de uma transação.

## 9. Evolução futura

Quando o projeto precisar de PostgreSQL ou MySQL, a mudança pode ser feita principalmente em:

- `src/database/connection.js`;
- migrations;
- repositories.

As regras de acesso, histórico do aluno, Portaria, Responsáveis, relatórios e frontend não precisam depender diretamente do fornecedor do banco.

## 10. Validação

Após a migração foram executados 68 testes, incluindo seis testes específicos da camada SQLite. Todos passaram sem falhas no ambiente da entrega.
