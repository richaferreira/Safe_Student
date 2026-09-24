# Validação Final — Persistência SQLite

Data da validação: 23/09/2026.

## Resultado da suíte

```text
68 testes executados
68 aprovados
0 falhas
```

## Testes adicionados para a migração

1. migrations criam as principais tabelas relacionais;
2. seed cria os dados fictícios no SQLite;
3. matrícula duplicada é bloqueada pela restrição `UNIQUE`;
4. vínculo para aluno inexistente é bloqueado pela `FOREIGN KEY`;
5. uma violação durante a gravação provoca `ROLLBACK` e não deixa dados parciais;
6. o arquivo gerado possui o cabeçalho binário oficial `SQLite format 3`.

## Smoke test HTTP

O servidor foi inicializado usando a nova persistência e foram verificados:

- `GET /api/health`: resposta `200`;
- `POST /api/login` com a conta de Gestão: resposta válida;
- leitura do banco após inicialização: migrations e seed disponíveis.

## Dados do banco após reset

```text
users                        4
students                     4
guardian_students            3
attendance                  40
notifications                3
messages                     2
audit_log                    1
guardian_invitations         1
```

## Conclusão

A persistência mutável do MVP passou de JSON para SQLite sem alterar os fluxos funcionais validados. O JSON permanece somente como seed fictício e como formato suportado pelo script de importação de bases antigas.
