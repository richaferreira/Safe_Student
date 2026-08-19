# Matriz de conformidade acadêmica — Safe Student

**Versão de auditoria:** 2.0  
**Data da revisão:** 18/08/2026  
**Disciplina:** Práticas Extensionistas Integradoras VI  
**Professor:** Altemar Sales de Oliveira  
**Equipe:** Flavio Gabrig Ferreira (202323361) e Richardson Conceição Ferreira (202323181)

## 1. Critério de auditoria

Esta matriz cruza os templates de Plano de Gerenciamento fornecidos à equipe, o material de MVP da disciplina, o modelo complementar de Plano de Projeto do Portal GSTI e o comportamento efetivamente presente em `Safe_Student_MVP/`.

A revisão V2 acrescenta um critério que passa a ser obrigatório em todo o pacote: **documento, requisito e diagrama não podem afirmar que uma funcionalidade existe se ela não puder ser localizada no código ou demonstrada no MVP**.

- **Atendido:** há artefato e/ou comportamento verificável.
- **Parcial:** existe conteúdo, mas falta evidência, medição ou validação necessária.
- **Não aplicável:** item não pertence ao tipo de entrega ou ao escopo acadêmico.

## 2. Template Adaptado 2024-2

| Item | Status | Evidência/ação |
|---|---|---|
| Resumo | Atendido | Plano e artigo revisados. |
| Introdução e justificativa | Atendido | Plano e artigo. |
| Matriz CSD | Atendido | Plano — análise de mercado. |
| Cinco Forças de Porter | Atendido | Plano e auditoria competitiva. |
| TAM/SAM/SOM | Atendido | Dimensionamento acadêmico documentado, com SOM tratado como piloto/ambiente controlado. |
| Perfil dos usuários | Atendido | Responsável, Portaria e Gestão Escolar. |
| Pesquisa em campo | **Parcial** | Existem resultados históricos declarados, mas não foram localizadas respostas brutas/termos preenchidos que permitam reproduzi-los. Não apresentar os números como evidência auditada. |
| Mapa de empatia | Atendido | Relatório de pesquisa e plano. |
| Protótipo 1 | Atendido documentalmente | Primeira iteração descrita. Capturas/wireframes devem ser mantidos como anexos quando disponíveis. |
| Melhorias/testes V1 | Atendido documentalmente | Alterações descritas no plano. |
| Protótipo 2 | Atendido | Interface web implementada. |
| Melhorias/testes V2 | Atendido | MVP revisado, testes automatizados e validação estruturada. |
| Project Canvas | Atendido | Plano unificado. |
| Objetivos SMART | Atendido | Plano unificado. |
| Produto e entregas | Atendido | Plano + repositório. |
| Matriz de rastreabilidade | Atendido | `docs/ESPECIFICACAO_REQUISITOS_V2.md` + checklist. |
| Premissas | Atendido | Plano. |
| Restrições | Atendido | Plano e README. |
| EAP | Atendido | Plano. |
| Atividades/estratégia | Atendido | Plano. |
| Lista de atividades/duração | Atendido | Plano. |
| Gantt | Atendido | Plano. |
| Marcos | Atendido | Plano. |
| Equipe | Atendido | Plano. |
| Matriz de comunicação | Atendido | Plano. |
| Relatórios de progresso | Atendido | Plano. |
| Partes interessadas | Atendido | Plano. |
| Mapa de comunicação | Atendido | Plano. |
| Relação de problemas | Atendido | Plano. |
| Riscos causa/consequência | Atendido | Plano. |
| EAP com riscos | Atendido documentalmente | Plano. |
| Avaliação/gerenciamento de riscos | Atendido | Plano + checklist. |
| Monitoramento e controle | Atendido | Plano. |
| Controle integrado de mudanças | Atendido | Plano. |
| Lições aprendidas | Atendido | Plano. |
| 3 a 5 funcionalidades essenciais | **Atendido** | O escopo acadêmico mantém exatamente cinco funções essenciais; recursos de apoio são separados. |

## 3. Cinco funcionalidades essenciais do MVP

1. **Autenticação e autorização por perfil.**
2. **Cadastro/vínculo aluno–responsável.**
3. **Registro de entrada e saída por QR/token simulado.**
4. **Notificação automática ao responsável vinculado.**
5. **Rastreabilidade por histórico, relatório e auditoria.**

Mensagens, exportações, tema, reset da base e coleta de feedback são recursos complementares de demonstração/validação.

## 4. Auditoria de requisitos e modelagem V2

A especificação anterior foi substituída tecnicamente por [`docs/ESPECIFICACAO_REQUISITOS_V2.md`](docs/ESPECIFICACAO_REQUISITOS_V2.md).

### Principais correções

- requisitos funcionais reescritos como obrigações verificáveis, cada um com critério de aceite;
- requisitos não funcionais passaram a indicar a forma de comprovação; metas sem medição não são declaradas como atendidas;
- casos de uso separados por ator para reduzir cruzamentos;
- associação ator–caso de uso usa **linha sólida sem seta**;
- classes conceituais deixaram de misturar chaves estrangeiras do modelo relacional;
- `Usuario` permanece uma única classe com `PerfilUsuario`, coerente com a implementação;
- DER lógico foi separado do diagrama de classes e passou a exibir PK/FK/UQ e cardinalidades;
- `messages.from_user_id` e `messages.to_user_id` são representadas como relações distintas;
- diagrama de sequência usa setas somente onde a notação exige mensagens direcionadas;
- diagrama de componentes usa dependências tracejadas e não desenha tecnologias futuras como se já existissem.

Os SVGs auditáveis ficam em [`docs/diagramas/`](docs/diagramas/).

## 5. Auditoria técnica do MVP V2

### Corrigido no backend/domínio

- base mutável padrão mudou de arquivo versionado para `data/db.runtime.json`, criada a partir de `db.seed.json`;
- `db.runtime.json` passou a ser ignorado pelo Git;
- diretório de mensagens retorna somente `id`, `name`, `role` e `status`;
- Gestão não recebe mais notificações privadas destinadas a responsáveis;
- Gestão não lê mais mensagens privadas entre outros usuários;
- dados de responsáveis em `/api/students` foram minimizados e só são incluídos para perfil de gestão;
- geração de token de aluno verifica colisão antes de salvar;
- taxa demonstrativa utiliza a mesma definição de dia escolar/fuso do servidor;
- CSV de validação exporta somente registros `APRESENTACAO`;
- restauração da demo gera evento `RESTAURAR_DEMO` na auditoria antes de invalidar sessões;
- rota de turmas passou a exigir perfil de gestão, pois é utilizada no cadastro administrativo;
- workflows que chamavam scripts já removidos foram eliminados da branch de revisão.

### Testes

A suíte V2 possui testes de domínio, segurança, API e regressões de privacidade. Foi executada localmente em Node.js 22 durante a revisão com **24 testes aprovados e 0 falhas**. A integração na `main` só deve ocorrer depois de confirmar também o estado do CI da branch.

As novas regressões verificam, entre outros pontos:

- minimização do diretório;
- isolamento de mensagens privadas;
- isolamento de notificações;
- exclusão de `DEMO_SEED` no CSV de validação;
- auditoria da restauração da demonstração;
- uso da chave de dia escolar no cálculo da taxa.

## 6. Modelo complementar Portal GSTI

| Item | Status | Observação |
|---|---|---|
| Resumo/contexto/apresentação | Atendido | Plano. |
| Objetivos/benefícios | Atendido | Plano. |
| Escopo, entregas, fora do escopo | Atendido | Plano. |
| Requisitos e abrangência | Atendido | Plano + especificação V2. |
| EAP | Atendido | Plano. |
| Prazo/restrições | Atendido | Plano. |
| Recursos financeiros | Atendido em nível acadêmico | Produção futura exige orçamento próprio. |
| Premissas | Atendido | Plano. |
| Organização/equipe | Atendido | Plano. |
| Patrocinador | **Não aplicável formalmente** | Não inventar patrocinador financeiro. |
| Gerente | Atendido | Richardson Conceição Ferreira. |
| Riscos | Atendido | Plano + checklist. |
| Marcos | Atendido | Plano. |
| Estimativa de custo | Atendido em nível acadêmico | Separação entre MVP atual e eventual produção. |
| Metodologia | Atendido | Iterativa/incremental + validação de MVP. |
| Requisitos de aprovação | Atendido | Plano + termos de aceite. |
| Infraestrutura/aquisições | Atendido | Plano e manual. |
| Comunicação | Atendido | Plano. |
| Planejamento/recursos | Atendido | Plano. |

## 7. Normas ABNT — aplicabilidade

A normalização final deve seguir a edição vigente adotada pela instituição e a orientação expressa da disciplina. A equipe deve registrar qualquer diferença entre a lista fornecida no enunciado e a edição normativa adotada na entrega.

| Norma citada no enunciado | Aplicabilidade ao Safe Student |
|---|---|
| NBR 6021 | Indireta; publicação periódica como um todo. |
| NBR 6022 | Aplicável ao artigo. |
| NBR 6023 | Aplicável às referências. |
| NBR 6024 | Aplicável à numeração progressiva. |
| NBR 6027 | Aplicável ao sumário. |
| NBR 6028 | Aplicável ao resumo. |
| NBR 6029 | Não é requisito central do pacote. |
| NBR 6034 | Somente se houver índice. |
| NBR 10520 | Aplicável às citações. |
| NBR 14724 | Aplicável à apresentação do trabalho acadêmico. |
| NBR ISO 2108 | Não aplicável sem solicitação de ISBN. |
| Norma de Apresentação Tabular — IBGE | Aplicável às tabelas apresentadas. |

## 8. Limitações deliberadas do MVP

- persistência local em JSON;
- sessão em memória;
- sem HTTPS próprio;
- sem banco transacional;
- sem backup/observabilidade corporativa;
- sem SMS/push real;
- sem biometria/NFC/catracas;
- sem homologação de produção;
- sem certificação formal LGPD/WCAG/OWASP.

Essas limitações são aceitáveis no **MVP acadêmico**, mas precisam permanecer explícitas para que a banca não confunda protótipo demonstrável com produto pronto para operação real.

## 9. Pendência que não pode ser fabricada

A pendência acadêmica material continua sendo a **evidência primária da pesquisa/validação com participantes**. O projeto possui instrumentos e resultados históricos declarados, mas não contém material primário suficiente para reproduzir esses números.

Portanto:

- não inventar participantes;
- não inventar respostas;
- não apresentar quantidade de participantes, percentuais ou média histórica como evidência auditada sem comprovação;
- usar o módulo Feedback para registrar avaliações reais;
- exportar `safe-student-validacao-mvp.csv`;
- anexar a exportação e/ou formulários anonimizados ao relatório.

## 10. Situação da revisão V2

**Código/MVP:** refatorado na branch de revisão; suíte local 24/24.  
**Requisitos:** reescritos e rastreáveis.  
**UML/DER:** refeitos com notação formal e separados por responsabilidade.  
**Documentação estrutural:** em processo de sincronização final com a V2.  
**Pesquisa de campo:** **Parcial** até anexar evidência primária real.  
**Produção:** fora do escopo acadêmico atual.
