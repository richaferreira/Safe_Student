# Auditoria Sênior V2 — Safe Student

**Escopo:** revisão técnica e acadêmica do repositório `richaferreira/Safe_Student` com foco em requisitos, UML/DER, comportamento real do MVP, segurança, privacidade, rastreabilidade, testes, documentação e coerência da apresentação.

## Princípio da revisão

Esta revisão trata o repositório como um projeto de Engenharia de Software que precisa ser defendido diante de um professor, analista ou desenvolvedor experiente. Portanto, nenhum componente é considerado implementado apenas porque aparece em um diagrama ou documento. A fonte de verdade técnica é o comportamento verificável do código, acompanhado por testes e documentos coerentes.

Também foi adotada uma regra importante para a parte extensionista: resultado de pesquisa sem formulário, termo, resposta anonimizada ou exportação que permita auditoria não é tratado como evidência comprovada. Os números históricos podem ser preservados como registro de uma versão anterior, mas não devem ser apresentados como resultado validado até que exista evidência primária.

## Achados que exigiram correção

| Severidade | Achado | Tratamento V2 |
|---|---|---|
| Crítico | Diagramas de casos de uso com excesso de cruzamentos e elementos que pareciam setas de fluxo | Separação por ator e uso de associação UML sólida, fina e sem seta |
| Crítico | Diagrama de classes misturando conceito, perfil e implementação | Modelo conceitual alinhado ao código: um `Usuario` com atributo de perfil, multiplicidades explícitas e associações sem setas de processo |
| Crítico | DER visualmente semelhante a fluxograma | DER lógico com PK/FK/UQ, tabelas associativas e cardinalidades; ligações representam relacionamentos, não fluxo |
| Alto | Referência a OWASP MASVS para aplicação web | Substituição por OWASP ASVS 5.0.0 |
| Alto | Gestão podia receber notificações destinadas a responsáveis | Consulta restrita ao destinatário autenticado |
| Alto | Gestão podia ler mensagens privadas de terceiros | Consulta restrita aos participantes da mensagem |
| Alto | Diretório de mensagens devolvia e-mail e vínculos que a interface não precisava | Projeção mínima: id, nome, perfil e status |
| Alto | CSV de validação misturava dados `DEMO_SEED` com coleta real | Exportação limitada a registros `APRESENTACAO` |
| Médio | Taxa de presença derivava o dia por UTC enquanto o servidor usava fuso escolar | Cálculo passa a usar a mesma função `dateKey` do dia escolar |
| Médio | Token aleatório de novo aluno sem verificação explícita de colisão | Geração verifica unicidade antes de salvar |
| Médio | Base mutável `db.json` ficou versionada com estado de execução | Runtime passa a usar `db.runtime.json`, gerado a partir de `db.seed.json` e ignorado pelo Git |
| Médio | Workflows antigos apontavam para scripts que já haviam sido apagados | Workflows quebrados removidos; CI principal preservado |
| Acadêmico | Plano e slides mostravam 15 participantes e média 4,4 sem evidência primária localizada | Dados deixam de ser apresentados como evidência auditada; nova coleta estruturada permanece necessária |

## Revisão por área

### `Safe_Student_MVP/server.js`

Revisado rota por rota. Foram tratados autenticação, escopo de autorização, diretório mínimo, mensagens privadas, notificações, cadastro e vínculo, geração de token, sequência de entrada/saída, cálculo por dia escolar, relatório/CSV, feedback e restauração da demonstração. A autorização permanece no backend; ocultar botão na interface nunca é tratado como controle de segurança.

### `Safe_Student_MVP/lib/domain.js`

As regras de perfil, alunos visíveis, sequência de entrada/saída e taxa de presença foram confrontadas com o servidor. O cálculo de frequência foi preparado para receber a função que resolve o dia no fuso escolar configurado.

### `Safe_Student_MVP/lib/security.js`

O uso de `scrypt` e `timingSafeEqual` é coerente com um MVP acadêmico. O uso síncrono não é apresentado como arquitetura recomendada para alta carga. Não existe alegação de certificação de segurança.

### Frontend (`public/`)

A interface usa token de sessão nas chamadas, inclusive nos downloads autenticados; conteúdo variável é escapado antes de ser inserido no HTML. Os controles visuais de perfil permanecem apenas como experiência de uso: a barreira real está nas rotas do servidor. Recursos de acessibilidade existentes são tratados como boas práticas, não como certificação WCAG.

### Dados

`db.seed.json` é uma base sintética de demonstração. A execução não deve alterar um arquivo versionado. A V2 gera `db.runtime.json` a partir da seed. Dados ilustrativos de feedback continuam claramente separados de dados coletados durante apresentação.

### Testes

Além dos testes já existentes de domínio, segurança e API, a V2 acrescenta regressões para minimização do diretório, isolamento de mensagens, isolamento de notificações, exportação do feedback sem `DEMO_SEED` e auditoria da restauração da demonstração.

## Requisitos V2

A especificação é reconstruída com requisitos funcionais escritos como obrigações observáveis e critérios de aceite. Requisitos não funcionais passam a informar a evidência esperada. Metas ainda não medidas — como desempenho local — permanecem marcadas como metas a comprovar em vez de aparecerem como atendimento já demonstrado.

Não é mantida uma quantidade artificial de requisitos apenas para preencher documento. A quantidade decorre do comportamento do MVP e da necessidade de rastreabilidade.

## Regras de notação adotadas nos novos diagramas

- **Caso de uso:** ator e caso de uso ligados por associação sólida simples, sem seta. `include` e `extend` somente seriam usados se uma relação semântica real os justificasse; não foram inseridos apenas para enfeitar o desenho.
- **Classes:** associações são linhas simples com multiplicidades. Setas de processo não são utilizadas. Perfis que no código são valores de `role` não são inventados como subclasses.
- **DER:** tabelas apresentam PK, FK e UQ; cardinalidades aparecem nos relacionamentos. O DER não é um fluxograma.
- **Sequência:** setas são corretas porque representam mensagens dirigidas entre participantes; retornos são tracejados.
- **Arquitetura:** somente componentes existentes no MVP são apresentados como implementados; banco corporativo, mensageria, hardware e integrações externas permanecem evolução futura.

## Documentos acadêmicos

- **01 — Plano:** resultados históricos da pesquisa sem evidência primária deixam de ser tratados como comprovados; menções a contagens rígidas de RF/RNF são removidas.
- **02 — Requisitos/UML/DER:** reconstruído em V2.0 e passa a ser a referência técnica oficial do projeto.
- **04 — Testes:** a documentação deixa de depender de uma contagem fixa de testes, que ficaria obsoleta a cada regressão adicionada.
- **05 — Pesquisa:** permanece a regra de não fabricar participantes nem respostas. A pendência é resolvida somente com evidência real.
- **06 — Auditoria:** reconstruído para registrar achados, correções e limitações sem declarar atendimento total quando existe pendência.
- **08 — Apresentação:** números de pesquisa não comprovados são removidos; referência de segurança web e diagramas são atualizados.
- **10 — Manual:** alinhado à base de runtime e às referências de segurança web.
- **09 — ZIP do MVP:** deve ser regenerado a partir do código final, sem incluir base mutável de execução.

## Pendência humana que permanece

A única correção que não pode ser produzida por código é a **evidência primária de pesquisa/validação com participantes reais**. Para fechar essa etapa, a equipe deve executar a validação, manter os termos necessários e anexar exportação anonimizada ou formulários que permitam reproduzir os resultados. Até isso acontecer, o status correto da pesquisa de campo é **Parcial**.

## Critério para integração à `main`

A revisão somente deve substituir a versão atual depois de: geração dos diagramas e documentos, execução da suíte automatizada, CI verde em Node 18/20/22, inspeção visual dos documentos gerados e confirmação de que a `main` não recebeu alterações concorrentes que seriam sobrescritas.
