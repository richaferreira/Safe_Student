# Revisão funcional e técnica — Safe Student

## Diagnóstico do código recebido

O cadastro original aceitava alunos sem responsável e o vínculo familiar era uma segunda operação. Não havia autocadastro por convite nem interface para revisar/desativar matrículas ou revogar vínculos. A área de gestão misturava tela de alunos com um formulário de vínculo exibido fora de contexto; o controle genérico `.role-manager` podia tornar visíveis seções e formulários fechados. A portaria exibia um QR decorativo, embora só aceitasse tokens digitados. Relatórios exibiam uma taxa acadêmica simulada sobre 20 dias, potencialmente confundida com frequência real. Alguns dados da base fictícia já estavam sem responsável ativo.

## Decisões de arquitetura implementadas

O projeto atual foi mantido, sem reescrever desnecessariamente a autenticação, modelos existentes e fluxo de notificação. A matrícula e a criação do vínculo ou convite agora ocorrem em uma única gravação atômica do arquivo, com validações no servidor. Após o `await` da leitura de payload, as rotas mutáveis relevantes releem o banco para reduzir sobrescritas de estado obsoleto no processo único. Esta medida **não substitui transações de um banco de dados** para múltiplas instâncias ou concorrência real.

Convites possuem código aleatório de 96 bits, SHA-256 armazenado no JSON, prazo de 30 dias, status PENDENTE/UTILIZADO/REVOGADO e revogação/renovação auditadas. A ativação só acontece com o e-mail do convite e o código vigente, impede uma segunda conta com o mesmo e-mail e requer senha de 10 a 128 caracteres com letras e números. O acesso familiar baseia-se nos vínculos aprovados pela gestão, nunca numa pesquisa aberta por sobrenome/e-mail.

As sessões são revalidadas contra o usuário e os vínculos atuais a cada requisição. Desativar aluno bloqueia operações de portaria e remove sua visualização da conta familiar, mas mantém o registro disponível à gestão para reativação. O escopo de notificações e mensagens continua aplicado no servidor.

## Recursos disponíveis por painel

| Módulo | Gestão | Portaria | Responsável |
|---|---|---|---|
| Cadastro e edição de aluno | Sim | Consulta de ativos | Consulta dos próprios filhos |
| Cadastro de responsável na matrícula | Sim | Não | Ativação mediante convite |
| Aprovação/remoção de vínculos | Sim | Não | Não |
| Renovar/revogar convite | Sim | Não | Não |
| Entrada/saída por token | Sim | Sim | Não |
| Notificação recebida | Própria | Própria | Própria e restrita aos filhos |
| Mensagens | Destinatários permitidos | Destinatários permitidos | Destinatários permitidos |
| Relatórios/CSV com filtros | Escopo operacional | Escopo operacional | Apenas filhos |
| Auditoria | Sim | Não | Não |

## Principais cenários testados

Foram verificados: cadastro sem responsável rejeitado sem criar aluno; matrícula com novo responsável cria convite; senha ou convite inválidos não ativam; matrícula de dois filhos para o mesmo e-mail unifica convite; convite antigo deixa de funcionar após renovar; responsável ativado visualiza seus dois filhos; terceiro filho da mesma pessoa aparece imediatamente na sessão aberta após aprovação pela gestão; usuário da portaria não visualiza dados de convite ou executa ações administrativas; responsável não consulta tokens; remoção do vínculo atualiza o escopo; desativação impede registrar entrada, reativação restitui o acesso conforme vínculo; entrada duplicada é bloqueada; saída exige entrada; relatórios filtrados não revelam outra família; exportação protege contra fórmula de planilha; convite pode ser revogado; envio de mensagem e leitura de notificação funcionam na interface.

Os testes automatizados de Node passaram com 44/44, e a interação em Chromium percorreu gestão → responsável → portaria → responsável → gestão. Erros JS observados no roteiro: zero; verificação final em largura de 390px sem rolagem horizontal. Isso valida **os cenários exercitados**, não equivale a afirmar ausência universal de defeitos.

## Pendências para produção

- Substituir JSON por banco transacional, com índices únicos para matrícula/e-mail, migrations e estratégia de backup/restore.
- Implementar envio e verificação efetiva de convite por e-mail, recuperação de senha, gestão segura de segredos e política antifraude para vínculos familiares.
- Implantar HTTPS, observabilidade, limitação distribuída de requisições, sessões persistentes e testes de múltiplas instâncias.
- Concluir homologação institucional, LGPD, retenção, controle de acesso por escola/unidade caso multi-instituição, e testes de carga/penetração.
- Integrar hardware/leitor de QR verdadeiro se a instituição adotar esse fluxo. Nesta entrega a portaria usa **código digitado/selecionado**, não câmera.
- Definir calendário letivo e critérios pedagógicos antes de adicionar taxa de frequência, justificativas de falta ou notificações externas. A saída da portaria é apenas um evento registrado.
