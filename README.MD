# 🛡️ Safe Student

> **MVP acadêmico de Engenharia de Software para presença escolar rastreável e comunicação família–escola**

[![Safe Student CI](https://github.com/richaferreira/Safe_Student/actions/workflows/ci.yml/badge.svg)](https://github.com/richaferreira/Safe_Student/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Situação técnica

O Safe Student é um **MVP acadêmico/extensionista**, não um produto homologado para produção.

A versão executável atual do MVP é **2.1.0**. A especificação acadêmica/modelagem está identificada como **V2.0**, pois representa a revisão formal dos requisitos e diagramas.


## Problema e proposta de valor

O projeto busca reduzir três dificuldades comuns no acompanhamento da movimentação escolar:

- baixa visibilidade dos responsáveis sobre entrada e saída;
- registros sujeitos a processos manuais e retrabalho;
- comunicação fragmentada entre família, portaria e gestão.

A hipótese do MVP é que um fluxo simples de identificação, registro rastreável e notificação rápida pode tornar a movimentação escolar mais clara e verificável.

## Cinco funcionalidades essenciais

1. **Autenticação e autorização por perfil.**
2. **Cadastro/vínculo aluno–responsável.**
3. **Registro de entrada e saída por QR/token simulado.**
4. **Notificação automática ao responsável vinculado.**
5. **Rastreabilidade por histórico, relatório e auditoria.**

Mensagens, exportações CSV, tema, restauração da demo e feedback são recursos complementares.

## Arquitetura implementada
A implementação executável atual fica em `Safe_Student_MVP/` e usa:
- **backend/API:** Node.js `>=22.13`, HTTP nativo e `node:sqlite`;
- **frontend:** HTML, CSS e JavaScript sem framework externo;
- **regras e serviços:** `src/app.js` e `src/services/`;
- **persistência mutável:** SQLite em `data/safe_student.db`, com schema/migrations em `src/database/`;
- **seed sintética:** `data/db.seed.json`;
- **sessões, tentativas e recuperação:** estado temporário em memória do processo;
- **testes:** `node:test`, com unidades e integrações.

A camada `src/database/repository.js` mantém compatibilidade entre os serviços e o armazenamento relacional SQLite.
## Executar

```bash
cd Safe_Student_MVP
npm start
```

Depois acesse `http://localhost:3000`.

### Perfis de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Responsável | `responsavel@demo.com` | `demo123` |
| Portaria | `portaria@demo.com` | `demo123` |
| Gestão | `gestor@demo.com` | `demo123` |

A base mutável SQLite `data/safe_student.db` é inicializada a partir da seed quando necessário. Para restaurar a demonstração pelo terminal:

```bash
npm run reset
```

## Testes

```bash
cd Safe_Student_MVP
npm test
```

`DEMO_SEED` é apenas dado ilustrativo. Somente registros `APRESENTACAO` entram como coleta realizada e são exportados no CSV de validação.


## Produção é outro estágio

Uma implantação real ainda exigiria HTTPS/TLS, banco transacional, gestão de segredos e sessões, backup, observabilidade, resposta a incidentes, política de retenção, testes de carga/segurança, validação institucional/jurídica e integração real de notificações. Esses itens **não são apresentados como implementados** no MVP.

## Privacidade e LGPD

O projeto usa princípios de minimização e separa demonstração acadêmica de uso real. A formulação apropriada é **“MVP com controles e princípios de privacidade alinhados à LGPD”**, e não “sistema certificado em conformidade com a LGPD”.

## Autores

- **Richardson Conceição Ferreira — 202323181**
- **Flavio Gabrig Ferreira — 202323361**
- **Lealdo Coelho Válido de Jesus — 202323215**

Disciplina: **Práticas Extensionistas Integradoras VI**.

## Licença

MIT. Consulte [`LICENSE`](LICENSE).
