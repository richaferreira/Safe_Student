# Safe Student MVP V2.0

MVP acadêmico demonstrável do Safe Student. A aplicação valida os fluxos centrais do projeto com **dados sintéticos**, sem assumir que o ambiente local é uma solução pronta para produção.

## Objetivo

Validar a hipótese de que um fluxo simples de identificação do estudante, registro de entrada/saída e comunicação rastreável pode melhorar a visibilidade da movimentação escolar para família, portaria e gestão.

## Cinco funcionalidades essenciais

1. autenticação e autorização por perfil;
2. cadastro/vínculo aluno–responsável;
3. entrada/saída por QR/token simulado;
4. notificação interna ao responsável vinculado;
5. rastreabilidade por histórico, relatório e auditoria.

Mensagens, CSV, reset da demonstração, tema e feedback são recursos complementares.

## Execução

1. Instale Node.js 18 ou superior.
2. Abra o terminal nesta pasta.
3. Execute `npm start`.
4. Acesse `http://localhost:3000`.

Não há dependências externas e o MVP usa somente módulos nativos do Node.js.

### Persistência da demonstração

- `data/db.seed.json` — estado inicial sintético, versionado;
- `data/db.runtime.json` — estado mutável da execução, criado automaticamente e **ignorado pelo Git**.

Para restaurar a base local:

```bash
npm run reset
```

Variáveis opcionais:

- `PORT` — padrão `3000`;
- `SS_DB_PATH` — permite substituir o caminho da base mutável;
- `SS_TIME_ZONE` — padrão `America/Sao_Paulo`;
- `SS_SESSION_TTL_MS` — duração da sessão em milissegundos.

## Perfis de apresentação

| Perfil | E-mail | Senha | Capacidades principais |
|---|---|---|---|
| Responsável | `responsavel@demo.com` | `demo123` | alunos vinculados, notificações, histórico, relatório, mensagens e feedback |
| Portaria | `portaria@demo.com` | `demo123` | entrada/saída e comunicação autorizada |
| Gestão | `gestor@demo.com` | `demo123` | cadastros, vínculos, presença, relatórios, auditoria, validação e reset |

Tokens de apresentação: `SS-ALU001` a `SS-ALU004`.

## Funcionalidades implementadas

- autenticação com sessão temporária;
- senha armazenada por hash `scrypt`;
- autorização por perfil no servidor;
- cadastro de aluno com validação de matrícula e token único;
- vínculo aluno–responsável;
- entrada/saída com validação de sequência por **dia escolar**;
- notificação interna ao responsável vinculado;
- histórico e relatório por escopo do usuário;
- exportação CSV autenticada;
- comunicação com matriz de destinatários validada no backend;
- mensagens visíveis somente aos participantes;
- diretório de comunicação com projeção mínima de dados;
- trilha de auditoria para Gestão/Admin;
- feedback com cenário, sucesso, tempo, nota e comentário;
- exportação de validação contendo apenas registros `APRESENTACAO`;
- restauração da demo auditada;
- cabeçalhos básicos de segurança;
- tratamento explícito do fuso escolar.

## Privacidade e autorização

A interface pode esconder opções conforme o perfil, mas isso é apenas experiência de uso. **O controle real está no backend.**

Na V2:

- Gestão não recebe notificações privadas destinadas aos responsáveis;
- Gestão não lê conversas privadas de terceiros;
- diretório de mensagens não retorna e-mail nem vínculos desnecessários;
- responsáveis retornados em consultas administrativas são minimizados;
- `DEMO_SEED` não pode ser exportado como evidência de pesquisa.

## Segurança acadêmica

O MVP inclui controles proporcionais a uma demonstração:

- `scrypt`;
- `timingSafeEqual`;
- tokens de sessão aleatórios;
- expiração de sessão;
- limitação de tentativas de login;
- RBAC no servidor;
- escopo por responsável;
- CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`;
- gravação da base por arquivo temporário + `rename`.

Esses controles **não são uma certificação de segurança nem tornam o MVP pronto para produção**.

## Testes

```bash
npm test
```

A suíte V2 cobre domínio, segurança, API e regressões de privacidade. Na revisão sênior ela foi executada localmente em Node.js 22 com **24 testes aprovados e 0 falhas**.

Entre os cenários verificados estão:

- normalização de token;
- RBAC de presença e mensagens;
- isolamento de alunos vinculados;
- entrada/saída válida e inválida;
- cálculo da taxa pela chave do dia escolar;
- hash e comparação de senha;
- geração aleatória de token;
- autenticação e autorização de API;
- CSV autenticado;
- bloqueio de destinatário manipulado;
- diretório com dados mínimos;
- isolamento de mensagens privadas;
- isolamento de notificações;
- separação entre `DEMO_SEED` e `APRESENTACAO`;
- CSV de validação sem seed ilustrativa;
- auditoria da restauração da demo.

O workflow `ci.yml` está configurado para Node 18, 20 e 22. O CI deve ser conferido antes de integrar a revisão na `main`.

## Validação acadêmica

Cada feedback novo recebe `source: APRESENTACAO`. Registros ilustrativos da seed são `DEMO_SEED` e não entram nos indicadores de coleta efetiva nem na exportação de validação.

A aplicação não solicita nome do participante no módulo Feedback. A evidência primária de pesquisa continua dependendo de coleta real, termos aplicáveis e anexação do CSV/formulários anonimizados.

## Limitações deliberadas

O MVP usa JSON local e sessão em memória. Não possui HTTPS próprio, banco relacional, serviço real de push/SMS, SSO, observabilidade corporativa, backup, biometria, NFC, catraca ou geolocalização contínua.

Antes de qualquer uso real, seria necessário tratar infraestrutura segura, banco transacional, segredos, retenção, backup, monitoramento, incidentes, testes de carga/segurança e validação institucional/jurídica.

## Modelagem técnica

A especificação e os diagramas V2 estão em:

- [`../docs/ESPECIFICACAO_REQUISITOS_V2.md`](../docs/ESPECIFICACAO_REQUISITOS_V2.md)
- [`../docs/diagramas/`](../docs/diagramas/)
