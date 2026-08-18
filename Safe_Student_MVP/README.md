# Safe Student MVP V1.1

MVP acadêmico demonstrável do projeto Safe Student. A aplicação foi construída para apresentar e validar os fluxos centrais sem utilizar dados reais de estudantes.

## Objetivo do MVP

Validar a hipótese de que um fluxo simples de identificação do estudante, registro de entrada/saída e comunicação rastreável pode melhorar a visibilidade da movimentação escolar para família, portaria e gestão.

### 5 funcionalidades essenciais

1. autenticação e RBAC por perfil;
2. cadastro/vínculo aluno–responsável;
3. entrada/saída por QR/token simulado;
4. notificação automática ao responsável;
5. rastreabilidade por histórico, relatórios e auditoria.

Os demais recursos são complementares para demonstração e validação.

## Execução

1. Instale Node.js 18 ou superior.
2. Abra um terminal nesta pasta.
3. Execute `npm start`.
4. Acesse `http://localhost:3000`.

Não há dependências externas e não é necessário executar `npm install`.

Variáveis opcionais:

- `PORT`: porta HTTP, padrão `3000`;
- `SS_DB_PATH`: caminho da base JSON;
- `SS_TIME_ZONE`: fuso escolar, padrão `America/Sao_Paulo`;
- `SS_SESSION_TTL_MS`: duração da sessão em milissegundos.

## Perfis de apresentação

| Perfil | E-mail | Senha | Principais capacidades |
|---|---|---|---|
| Responsável | `responsavel@demo.com` | `demo123` | alunos vinculados, notificações, histórico, relatórios, mensagens e feedback |
| Portaria | `portaria@demo.com` | `demo123` | registro de entrada/saída, consulta operacional e comunicação permitida |
| Gestão | `gestor@demo.com` | `demo123` | cadastros, vínculos, presença, relatórios, auditoria, validação e reset da demo |

Tokens de apresentação: `SS-ALU001`, `SS-ALU002`, `SS-ALU003`, `SS-ALU004`.

## Funcionalidades implementadas

- autenticação com sessão temporária e senha armazenada por hash;
- autorização por perfil (RBAC) no servidor;
- cadastro de aluno de apresentação e vínculo com responsável;
- registro de entrada/saída por QR/token simulado;
- validação de sequência entrada → saída por dia escolar;
- notificações automáticas ao responsável;
- histórico e relatório por aluno;
- exportação CSV autenticada;
- comunicação com autorização de destinatários também no backend;
- trilha de auditoria para gestão;
- módulo de validação com cenário, sucesso, tempo, nota e comentário;
- exportação CSV da validação para gestão;
- separação entre dados ilustrativos e evidências coletadas;
- reset da base de apresentação;
- layout responsivo, navegação por teclado e tema claro/escuro;
- cabeçalhos básicos de segurança;
- tratamento explícito do fuso escolar.

## Segurança acadêmica implementada

O MVP inclui controles proporcionais a uma demonstração:

- `scrypt` para hash de senha;
- comparação com `timingSafeEqual`;
- tokens de sessão aleatórios;
- expiração de sessão;
- limitação de tentativas de login;
- RBAC no backend;
- escopo de estudantes por responsável;
- autorização de mensagens no servidor;
- CSP, proteção contra frame, MIME sniffing, política de referência e permissões de navegador;
- escrita local por arquivo temporário + rename para reduzir risco de corrupção parcial.

Esses controles **não transformam o MVP em solução pronta para produção**.

## Validação acadêmica

O menu **Feedback** registra evidências de teste sem solicitar identificação do participante. Cada avaliação nova recebe `source: APRESENTACAO`.

Os registros que já vêm no `db.seed.json` não possuem essa marca e são tratados como `DEMO_SEED`. Eles servem apenas para ilustrar a interface e **não entram nos indicadores de evidência coletada**.

Indicadores disponíveis:

- quantidade de avaliações coletadas;
- nota média;
- taxa de conclusão das tarefas;
- tempo médio informado;
- comentários qualitativos.

A gestão pode exportar `safe-student-validacao-mvp.csv` para consolidar a pesquisa.

## Testes

Execute:

```bash
npm test
```

A suíte usa `node:test` e cobre:

- normalização de token;
- RBAC de presença;
- RBAC de mensagens;
- isolamento dos estudantes do responsável;
- regras entrada → saída;
- cálculo de taxa demonstrativa;
- hash/verificação de senha;
- robustez contra hash inválido;
- geração de token;
- health check;
- login inválido;
- bloqueio de presença para responsável;
- registro de presença pela portaria;
- bloqueio de destinatário indevido pela API;
- autenticação da exportação CSV;
- separação de `DEMO_SEED` e evidência coletada;
- autorização para exportação da validação.

O repositório também possui GitHub Actions para executar a suíte em Node 18, 20 e 22.

## Limitações deliberadas

Este é um MVP acadêmico, não uma aplicação pronta para produção. Usa arquivo JSON como persistência local; não possui HTTPS próprio, banco relacional, serviço real de push/SMS, SSO, observabilidade corporativa ou rotina de backup. Biometria, NFC, catracas e geolocalização contínua ficam fora do escopo do MVP.

A sessão fica em memória no servidor e o token é mantido em `sessionStorage` no navegador, o que é aceitável para a demonstração, mas deve ser substituído por uma estratégia corporativa em produção.

## Requisitos antes de uso real

Antes de qualquer uso com dados reais, migrar a persistência para banco transacional, usar HTTPS/TLS, segredo de sessão externo, política de retenção, monitoramento, backups, testes de segurança, gestão de incidentes, RIPD/DPIA quando aplicável e validação institucional/jurídica.

A documentação acadêmica deve tratar o sistema como **alinhado a princípios de privacidade**, sem declarar certificação legal ou conformidade automática com a LGPD.
