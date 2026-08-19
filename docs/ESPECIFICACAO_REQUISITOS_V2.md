# Safe Student — Especificação de Requisitos e Modelagem V2.0

**Disciplina:** Práticas Extensionistas Integradoras VI  
**Professor:** Altemar Sales de Oliveira  
**Integrantes:** Flavio Gabrig Ferreira — 202323361; Richardson Conceição Ferreira — 202323181  
**Gerente do projeto:** Richardson Conceição Ferreira — 202323181  
**Revisão:** 18/08/2026

> Esta versão substitui a especificação anterior como **referência técnica**. Ela foi reescrita a partir do comportamento realmente presente no MVP e da revisão linha a linha do backend, domínio, segurança, interface, dados e testes.

## 1. Visão geral

O Safe Student é um MVP acadêmico para registro rastreável de entrada e saída de estudantes e comunicação entre escola e responsáveis. A V2.0 separa claramente três coisas que antes apareciam misturadas: **o que está implementado**, **o que é requisito verificável** e **o que é apenas evolução futura**.

### 1.1 Escopo implementado

- autenticação e autorização por perfil;
- cadastro de aluno pela Gestão Escolar;
- vínculo aluno–responsável;
- entrada e saída por token/QR representado na demonstração;
- notificação interna ao responsável vinculado;
- histórico, relatório e exportação CSV autenticada;
- comunicação entre perfis autorizados;
- trilha de auditoria;
- coleta estruturada de feedback acadêmico;
- restauração da base de demonstração.

### 1.2 Fora do escopo

Biometria, reconhecimento facial, NFC/RFID, catracas, geolocalização contínua, SMS/WhatsApp/push real, banco corporativo, SSO/OAuth2 e homologação de produção **não pertencem ao MVP atual**.

## 2. Atores

| Ator | Responsabilidade no MVP | Restrições relevantes |
|---|---|---|
| Responsável | acompanhar alunos vinculados, consultar histórico/notificações, gerar relatório do próprio escopo, comunicar-se e registrar feedback | não registra presença, não cadastra aluno/vínculo, não consulta auditoria nem exporta validação |
| Portaria | registrar entrada/saída de alunos ativos e comunicar-se com perfis autorizados | não cadastra aluno/vínculo, não consulta auditoria e não lê mensagens de terceiros |
| Gestão Escolar | cadastrar aluno, criar vínculo, registrar presença, gerar relatórios, consultar auditoria, comunicar-se, exportar validação e restaurar a demo | não recebe autorização implícita para ler conversas privadas de outros usuários |
| Administrador técnico | perfil suportado no backend para tarefas técnicas | não é apresentado como uma das cinco funcionalidades essenciais do MVP |

## 3. Critério de escrita adotado

Um requisito só permanece nesta versão quando pode ser confrontado com um comportamento observável. Os RF são escritos como obrigações do sistema e possuem critério de aceite. Os RNF indicam como a característica deve ser verificada. Expressões vagas como “sistema seguro”, “100% acessível” ou “em conformidade com a LGPD” não são usadas como resultado técnico sem evidência correspondente.

## 4. Requisitos funcionais

| ID | Requisito | Critério de aceite | Prioridade |
|---|---|---|---|
| RF-01 | O sistema deve autenticar usuário ativo por e-mail e senha. | Credenciais válidas criam sessão; inválidas não criam sessão e retornam erro. | Alta |
| RF-02 | O sistema deve autorizar cada operação no servidor conforme o perfil do usuário. | Chamada direta à API com perfil sem permissão é bloqueada. | Alta |
| RF-03 | A Gestão Escolar deve poder cadastrar aluno ativo informando nome, matrícula e turma válidos. | Dados inválidos são rejeitados; matrícula e token não colidem com outro aluno. | Alta |
| RF-04 | A Gestão Escolar deve poder vincular um responsável ativo a um aluno ativo. | Após o vínculo, o aluno passa a integrar o escopo do responsável. | Alta |
| RF-05 | Portaria e Gestão Escolar devem poder registrar entrada de aluno ativo por token válido. | Entrada é persistida com horário e operador; segunda entrada pendente no mesmo dia é bloqueada. | Alta |
| RF-06 | Portaria e Gestão Escolar devem poder registrar saída somente depois de entrada válida no mesmo dia escolar. | Saída sem entrada anterior é bloqueada; saída válida é persistida. | Alta |
| RF-07 | Depois de um registro de presença, o sistema deve gerar notificação interna para cada responsável vinculado ao aluno. | A notificação pertence ao respectivo responsável e a quantidade notificada é informada no retorno da operação. | Alta |
| RF-08 | O sistema deve permitir consulta do histórico apenas dos alunos pertencentes ao escopo do usuário autenticado. | Responsável vê somente vinculados; demais perfis recebem somente o conjunto necessário às suas funções. | Alta |
| RF-09 | O sistema deve gerar resumo de presença por aluno permitido ao usuário. | Resumo contém entradas, saídas, taxa demonstrativa e último registro sem incluir aluno fora do escopo. | Média |
| RF-10 | O sistema deve exportar o histórico permitido em CSV autenticado. | Sem sessão a exportação é negada; com sessão o arquivo contém somente registros autorizados. | Média |
| RF-11 | O sistema deve permitir mensagens somente entre perfis autorizados e exibir cada mensagem somente aos participantes. | Manipular `toUserId` não contorna a regra; Gestão não lê conversa privada de terceiros. | Média |
| RF-12 | O sistema deve registrar eventos críticos em trilha de auditoria e permitir consulta pela Gestão. | Eventos relevantes registram usuário, ação e horário quando aplicável. | Alta |
| RF-13 | O usuário deve poder consultar suas próprias notificações e marcar a própria notificação como lida. | Notificação de outro usuário não pode ser alterada. | Média |
| RF-14 | O sistema deve coletar feedback estruturado e permitir à Gestão exportar apenas evidências realmente registradas durante a apresentação. | `DEMO_SEED` não entra nos indicadores nem no CSV de evidência coletada; somente `APRESENTACAO` é exportado. | Média |
| RF-15 | A Gestão Escolar deve poder restaurar a base de demonstração. | A seed é reposta, a restauração gera auditoria e as sessões em memória são invalidadas. | Baixa |

## 5. Requisitos não funcionais

| ID | Categoria | Requisito verificável | Evidência/forma de verificação |
|---|---|---|---|
| RNF-01 | Segurança de credenciais | Senhas de demonstração devem permanecer armazenadas por `scrypt`; comparação deve usar `timingSafeEqual`. | `lib/security.js` e testes de segurança |
| RNF-02 | Sessão | Sessões devem expirar; padrão da demonstração: 2 horas, configurável por variável de ambiente. | inspeção do servidor + testes de autenticação |
| RNF-03 | Privacidade/minimização | APIs auxiliares devem retornar somente os dados necessários e a demonstração deve usar dados sintéticos. | testes de regressão de privacidade + inspeção da seed |
| RNF-04 | Acessibilidade | A interface deve manter navegação por teclado, foco visível, rótulos e estrutura semântica compatíveis com avaliação baseada em WCAG 2.2. | inspeção manual; **não equivale a certificação WCAG** |
| RNF-05 | Desempenho | No conjunto de demonstração, respostas de uso corrente possuem **meta** de até 2 s em execução local. | exige medição reproduzível; não deve ser declarado como comprovado sem evidência |
| RNF-06 | Compatibilidade de runtime | O backend deve executar em Node.js 18, 20 e 22. | workflow de CI e suíte automatizada |
| RNF-07 | Portabilidade | O MVP não deve exigir banco, mensageria ou serviço externo para iniciar localmente. | `npm start` com módulos nativos do Node.js |
| RNF-08 | Integridade de presença | Sequência de entrada/saída deve ser validada e o dia deve respeitar o fuso escolar configurado. | testes de domínio/API e `dateKey` |
| RNF-09 | Integridade cadastral | Matrícula e token de aluno devem ser únicos no conjunto de dados. | validação de matrícula + geração de token com verificação de colisão |
| RNF-10 | Auditabilidade | Eventos críticos devem registrar identificador, usuário, ação e data/hora. | função `audit` + endpoint `/api/audit` |
| RNF-11 | Testabilidade | Domínio, segurança e API devem possuir testes automatizados executáveis por `npm test`. | arquivos em `tests/` |
| RNF-12 | Manutenibilidade | Regras reutilizáveis devem permanecer separadas entre domínio, segurança, servidor, interface e dados. | organização de `Safe_Student_MVP/` |

## 6. Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Somente aluno `ATIVO` pode receber registro de presença. |
| RN-02 | Entrada duplicada sem saída anterior no mesmo dia escolar deve ser recusada. |
| RN-03 | Saída exige entrada anterior válida no mesmo dia escolar. |
| RN-04 | Responsável consulta somente aluno explicitamente vinculado. |
| RN-05 | Somente Gestão/Admin cadastra aluno e cria vínculo. |
| RN-06 | Somente Portaria/Gestão/Admin registra presença. |
| RN-07 | Presença gera notificação para cada responsável ativo vinculado. |
| RN-08 | Mensagens respeitam a matriz de perfis autorizados e não podem ser lidas por terceiros. |
| RN-09 | Feedback `DEMO_SEED` é ilustrativo e não constitui evidência de pesquisa. |
| RN-10 | Biometria, NFC/RFID, catraca e geolocalização contínua não pertencem ao MVP. |
| RN-11 | Dados reais só podem ser usados após autorização, base legal, governança e segurança adequadas. |
| RN-12 | O dia escolar é calculado no fuso configurado; padrão da demonstração: `America/Sao_Paulo`. |

## 7. Casos de uso textuais

| ID | Caso | Ator | Pré-condição | Fluxo principal | Alternativa/erro |
|---|---|---|---|---|---|
| UC-01 | Autenticar-se | todos os perfis | usuário ativo | validar credenciais, criar sessão e auditar login | credencial inválida: 401; limite: 429 |
| UC-02 | Registrar entrada | Portaria/Gestão | sessão e token válidos | validar aluno e sequência, gravar entrada, notificar e auditar | token inválido: 404; entrada pendente: 409 |
| UC-03 | Registrar saída | Portaria/Gestão | existe entrada no mesmo dia | validar sequência, gravar saída, notificar e auditar | sem entrada: 409 |
| UC-04 | Consultar histórico/relatório | conforme perfil | sessão válida | calcular escopo e devolver somente registros permitidos | sem sessão: 401 |
| UC-05 | Cadastrar aluno | Gestão | sessão de gestão | validar dados, matrícula e gerar token único | inválido: 400; matrícula duplicada: 409 |
| UC-06 | Vincular responsável | Gestão | aluno e responsável ativos | adicionar vínculo sem duplicidade | entidade ausente/inativa: 404 |
| UC-07 | Consultar/marcar notificação | usuário destinatário | sessão válida | listar próprias notificações e marcar própria como lida | notificação de terceiro: 404 |
| UC-08 | Enviar mensagem | Responsável/Portaria/Gestão | destinatário permitido | validar matriz, gravar e disponibilizar só aos participantes | destinatário não permitido: 403 |
| UC-09 | Consultar auditoria | Gestão/Admin | perfil autorizado | listar eventos recentes | não autorizado: 403 |
| UC-10 | Registrar feedback | usuário autenticado | tarefa de validação executada | registrar cenário, sucesso, tempo, nota e comentário como `APRESENTACAO` | campo inválido: 400 |
| UC-11 | Exportar validação | Gestão/Admin | perfil autorizado | gerar CSV apenas com `APRESENTACAO` | não autorizado: 403 |
| UC-12 | Restaurar demonstração | Gestão/Admin | perfil autorizado | restaurar seed, auditar e invalidar sessões | não autorizado: 403 |

## 8. Diagramas de casos de uso

Os diagramas foram separados por ator para reduzir cruzamentos. A ligação ator–caso de uso é uma **associação sólida sem seta**.

- [Responsável](diagramas/01_uc_responsavel.svg)
- [Portaria](diagramas/02_uc_portaria.svg)
- [Gestão Escolar](diagramas/03_uc_gestao.svg)

Não foram usados `<<include>>` e `<<extend>>` apenas por aparência. Uma relação desse tipo só deveria existir quando a semântica do caso realmente a justificasse.

## 9. Diagramas de classes

- [Núcleo de presença](diagramas/04_classes_nucleo.svg)
- [Comunicação, auditoria e validação](diagramas/05_classes_suporte.svg)

O código possui **um único `Usuario` com atributo de perfil**; por isso Responsável, Portaria e Gestão não foram inventados como subclasses. A enumeração `PerfilUsuario` expressa os valores de perfil. As associações possuem multiplicidade e não são setas de processo.

## 10. Modelo relacional — DER lógico

- [DER do núcleo](diagramas/06_der_nucleo.svg)
- [DER de suporte](diagramas/07_der_suporte.svg)

O DER é uma proposta lógica para futura persistência relacional. `guardian_students` resolve a relação N:N entre responsáveis e alunos. `messages.from_user_id` e `messages.to_user_id` são duas FKs distintas e, por isso, aparecem como **dois relacionamentos distintos** com `users`.

## 11. Diagrama de sequência

[Registrar entrada/saída](diagramas/08_sequencia_presenca.svg)

Neste diagrama as setas são corretas: elas representam mensagens dirigidas. Retornos são tracejados. O fluxo corresponde a `POST /api/attendance`.

## 12. Arquitetura implementada

[Diagrama de componentes](diagramas/09_arquitetura_componentes.svg)

A implementação real usa:

- `public/`: HTML, CSS e JavaScript;
- `server.js`: API HTTP e coordenação do fluxo;
- `lib/domain.js`: regras reutilizáveis de domínio;
- `lib/security.js`: hashing e token aleatório;
- `data/db.seed.json`: estado inicial sintético;
- `data/db.runtime.json`: arquivo mutável de execução, criado localmente e ignorado pelo Git.

Banco transacional, HTTPS gerenciado, serviços externos e hardware permanecem evolução futura.

## 13. Rastreabilidade

| Requisito | Implementação principal | Evidência automatizada |
|---|---|---|
| RF-01 | `POST /api/login`, `verifyPassword` | `api.test.js`, `security.test.js` |
| RF-02 | guards de perfil e funções `can*` | `api.test.js`, `privacy-regression.test.js` |
| RF-03 | `POST /api/students`, `uniqueStudentToken` | API + inspeção |
| RF-04 | `POST /api/links` | API/fluxo funcional |
| RF-05/RF-06 | `POST /api/attendance`, `validateAttendanceSequence` | `domain.test.js`, `api.test.js` |
| RF-07/RF-13 | notifications e `PATCH /api/notifications/:id` | API/fluxo funcional |
| RF-08/RF-09 | `allowedStudentIds`, dashboard e reports | domínio/API |
| RF-10 | `GET /api/reports.csv` | `api.test.js` |
| RF-11 | `canMessageRole`, `visibleDirectory`, messages | domínio/API/privacidade |
| RF-12 | `audit`, `GET /api/audit` | regressões + fluxo funcional |
| RF-14 | feedback e `GET /api/feedback.csv` | API + privacidade |
| RF-15 | `POST /api/demo/reset` | `privacy-regression.test.js` |

## 14. Correções resultantes da auditoria sênior

| Problema encontrado | Correção V2 |
|---|---|
| diagramas de casos de uso com aparência de fluxograma e relações ambíguas | diagramas separados por ator e associações sem seta |
| classes contendo IDs de FK como se fossem simultaneamente modelo conceitual e relacional | classes conceituais sem FKs; FKs ficam no DER |
| perfis desenhados como entidades/classes sem correspondência no código | `Usuario` único + enumeração `PerfilUsuario` |
| DER com ligação genérica remetente/destinatário | duas relações independentes para as duas FKs de `messages` |
| referência OWASP MASVS em aplicação web | uso de OWASP ASVS como referência de segurança web |
| Gestão recebendo notificações de responsáveis | dashboard restringido ao destinatário |
| Gestão lendo mensagens privadas de terceiros | mensagens restringidas aos participantes |
| diretório expondo e-mail e vínculos sem necessidade | projeção mínima de dados |
| taxa demonstrativa usando corte UTC enquanto o dia operacional usa fuso escolar | cálculo unificado pelo `dateKey` do servidor |
| geração aleatória de token sem checagem explícita de colisão | geração com verificação de unicidade |
| CSV de validação contendo `DEMO_SEED` | exportação apenas de `APRESENTACAO` |
| base mutável `db.json` versionada | `db.runtime.json` criado da seed e ignorado no Git |
| restauração da demo sem registro da ação | evento `RESTAURAR_DEMO` adicionado à auditoria |

## 15. Limitação acadêmica que permanece

A evidência primária da pesquisa de campo **não pode ser fabricada**. Enquanto não houver formulários/termos preenchidos, respostas anonimizadas ou exportação real de coleta, números históricos como quantidade de participantes e média de satisfação não devem ser apresentados como resultados auditados. O status correto dessa parte continua **Parcial**.

## Referências técnicas

- OBJECT MANAGEMENT GROUP. *Unified Modeling Language (UML), Version 2.5.1*.
- OWASP FOUNDATION. *Application Security Verification Standard (ASVS) 5.0.0*.
- WORLD WIDE WEB CONSORTIUM. *Web Content Accessibility Guidelines (WCAG) 2.2*.
- BRASIL. Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais.
- ABNT NBR 10520:2023 e edição de NBR 6023 adotada pela instituição para normalização das referências.
