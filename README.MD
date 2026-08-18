# 🛡️ Safe Student

> **Sistema Integrado de Gestão, Acesso e Segurança Escolar — MVP acadêmico de Engenharia de Software**

[![Safe Student CI](https://github.com/richaferreira/Safe_Student/actions/workflows/ci.yml/badge.svg)](https://github.com/richaferreira/Safe_Student/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Sobre o projeto

O **Safe Student** é um projeto acadêmico/extensionista voltado à rastreabilidade de entrada e saída de estudantes e à comunicação entre instituição e responsáveis. O repositório reúne documentação de gerenciamento, requisitos, UML/DER, artigo acadêmico, testes, pesquisa de campo, auditoria, planilhas de rastreabilidade, apresentação e um MVP web demonstrável.

O software existente neste repositório é **um MVP acadêmico**, executado com dados de demonstração. Ele não deve ser apresentado como solução pronta para produção nem como sistema juridicamente certificado em conformidade com a LGPD.

## Problema e proposta de valor

O projeto busca reduzir três dificuldades observadas no contexto escolar:

- baixa visibilidade dos responsáveis sobre horários de entrada e saída;
- registros de presença e movimentação sujeitos a processos manuais;
- comunicação fragmentada entre família, portaria e gestão.

A hipótese central do MVP é que **um fluxo simples de identificação do estudante, registro rastreável e notificação rápida ao responsável pode tornar o acompanhamento da movimentação escolar mais claro e operacionalmente verificável**.

## As 5 funcionalidades essenciais do MVP

Em atendimento ao escopo acadêmico, as funcionalidades essenciais foram separadas dos recursos complementares:

1. **Autenticação e autorização por perfil (RBAC)** — Responsável, Portaria e Gestão possuem permissões diferentes.
2. **Cadastro/vínculo aluno–responsável** — o responsável acessa apenas os estudantes vinculados.
3. **Registro de entrada e saída por QR/token simulado** — com validação de sequência entrada → saída.
4. **Notificação automática ao responsável** — gerada após o registro da movimentação.
5. **Rastreabilidade** — histórico, relatório e trilha de auditoria das operações relevantes.

Dashboard, exportação CSV, mensagens, tema claro/escuro, reset da base e módulo estruturado de feedback são **recursos complementares de apoio à demonstração e validação**.

## Arquitetura atual do MVP

A implementação real presente em `Safe_Student_MVP/` utiliza:

- **Backend:** Node.js 18+ com módulos nativos (`http`, `fs`, `crypto`);
- **Frontend:** HTML, CSS e JavaScript sem framework;
- **Persistência:** JSON local, exclusivamente para demonstração;
- **Autenticação:** sessão temporária em memória e token aleatório;
- **Senhas:** hash com `scrypt` e comparação `timingSafeEqual`;
- **Autorização:** RBAC validado no servidor;
- **Testes:** `node:test`, cobrindo domínio, segurança e API;
- **CI:** GitHub Actions em Node 18, 20 e 22.

Essa é a **arquitetura implementada**, não uma arquitetura corporativa de produção.

## Controles implementados no MVP

- autorização por perfil no backend;
- limitação de tentativas de login;
- sessão com expiração;
- escrita local com troca atômica de arquivo;
- validação de sequência de presença;
- escopo de dados por responsável;
- autorização de destinatários de mensagens no servidor;
- exportação CSV autenticada;
- tratamento explícito do fuso `America/Sao_Paulo` por padrão;
- `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`;
- trilha de auditoria;
- dados ilustrativos de feedback separados das evidências coletadas durante apresentação/teste.

## Validação acadêmica do MVP

O módulo **Feedback** foi estruturado para registrar, sem identificar o participante:

- perfil avaliado;
- cenário/tarefa executada;
- conclusão ou não da tarefa;
- tempo aproximado;
- nota de 1 a 5;
- comentário qualitativo.

Os registros preexistentes na base são tratados como **dados ilustrativos (`DEMO_SEED`)** e não contam como evidência de pesquisa de campo. Apenas avaliações efetivamente registradas durante a apresentação/teste entram nos indicadores de validação.

Consulte [`VALIDACAO_MVP.md`](VALIDACAO_MVP.md) para o protocolo de coleta e [`ACADEMIC_COMPLIANCE.md`](ACADEMIC_COMPLIANCE.md) para a matriz de conformidade acadêmica.

## Executar o MVP

```bash
cd Safe_Student_MVP
node server.js
```

ou:

```bash
cd Safe_Student_MVP
npm start
```

Acesse `http://localhost:3000`.

Perfis de demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Responsável | `responsavel@demo.com` | `demo123` |
| Portaria | `portaria@demo.com` | `demo123` |
| Gestão | `gestor@demo.com` | `demo123` |

## Testes

```bash
cd Safe_Student_MVP
npm test
```

A suíte cobre regras de domínio, hashing de senha, autenticação, autorização, presença, mensagens, CSV e validação do MVP.

## Estrutura acadêmica do repositório

| Arquivo | Finalidade |
|---|---|
| `01_Plano_Gerenciamento_Unificado_Safe_Student.*` | Plano de gerenciamento do projeto |
| `02_Especificacao_Requisitos_UML_DER_Safe_Student.*` | Requisitos, UML e DER |
| `03_Artigo_Safe_Student_ABNT.*` | Artigo acadêmico |
| `04_Plano_Relatorio_Testes_Safe_Student.*` | Plano/relatório de testes |
| `05_Relatorio_Pesquisa_Campo_Extensionista_Safe_Student.*` | Pesquisa de campo |
| `06_Relatorio_Auditoria_Conformidade_Safe_Student.*` | Auditoria de conformidade |
| `07_Checklist_Riscos_Rastreabilidade_Safe_Student.xlsx` | Checklist, riscos e rastreabilidade |
| `08_Apresentacao_Final_Safe_Student.pptx` | Apresentação final |
| `09_Safe_Student_MVP_codigo.zip` | Pacote do MVP |
| `10_Manual_Usuario_Implantacao_Treinamento_Suporte.*` | Manual e implantação |
| `11_Modelos_Termos_Pesquisa_Aceite_Safe_Student.*` | Termos, pesquisa e aceite |
| `12_Auditoria_Competitiva_Safe_Student.xlsx` | Auditoria competitiva |

## Evolução prevista para produção

Uma versão real exigiria, entre outras medidas:

- HTTPS/TLS obrigatório;
- banco transacional como PostgreSQL/MySQL;
- gestão segura de segredos e sessões;
- backups e recuperação;
- observabilidade e monitoramento;
- testes de segurança e carga;
- política institucional de retenção e descarte;
- gestão de incidentes;
- validação institucional e jurídica;
- RIPD/DPIA quando aplicável;
- integração real de notificações;
- eventual integração com hardware somente após análise de necessidade, privacidade e segurança.

Tecnologias como Redis, OAuth2/SSO, Docker, CI/CD ampliado, QR físico, NFC/RFID ou outros componentes são **possibilidades de evolução**, não funcionalidades atualmente implementadas.

## Privacidade e LGPD

O projeto adota princípios de minimização de dados e separa explicitamente o ambiente acadêmico de uma implantação real. A expressão adequada é **“projeto com controles e princípios de privacidade alinhados à LGPD”**, e não “sistema certificado em conformidade com a LGPD”. Qualquer operação com dados reais depende de base legal, governança, segurança, documentação e validação institucional/jurídica.

## Autores

- **Richardson Conceição Ferreira — 202323181**
- **Flavio Gabrig Ferreira — 202323361**

Disciplina indicada no pacote acadêmico: **Práticas Extensionistas Integradoras VI**.

## Licença

MIT. Consulte [`LICENSE`](LICENSE).
