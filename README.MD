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

A implementação em `Safe_Student_MVP/` usa:

- **backend:** Node.js 18+ com módulos nativos (`http`, `fs`, `crypto`);
- **frontend:** HTML, CSS e JavaScript sem framework;
- **domínio:** `lib/domain.js`;
- **segurança:** `lib/security.js`;
- **seed sintética:** `data/db.seed.json`;
- **base mutável local:** `data/db.runtime.json`, criada automaticamente e ignorada pelo Git;
- **sessões:** memória do processo com expiração;
- **senhas:** `scrypt` + `timingSafeEqual`;
- **testes:** `node:test` para domínio, segurança, API e regressões de privacidade.

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

A base mutável `db.runtime.json` é criada a partir da seed na primeira execução. Para restaurá-la pelo terminal:

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
