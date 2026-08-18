# Protocolo de validação do MVP Safe Student

## Objetivo

Gerar evidências reproduzíveis de que os cinco fluxos essenciais do MVP são compreensíveis, executáveis e coerentes com as necessidades dos perfis Responsável, Portaria e Gestão.

## Regra de integridade acadêmica

Os registros existentes em `db.seed.json` são **dados ilustrativos**. Eles não podem ser apresentados como respostas de pessoas reais. O backend V1.1 considera como evidência somente registros criados durante a apresentação/teste com `source: APRESENTACAO`.

O relatório de pesquisa anteriormente incluído no repositório declara 15 participantes e percentuais agregados, porém não há respostas brutas anonimizadas anexadas que permitam auditar esses resultados. Até que a equipe anexe a comprovação, esses números devem ser apresentados como **resultados declarados na versão anterior, pendentes de evidência primária**.

## Participantes sugeridos

A coleta deve buscar representação dos três perfis do problema, respeitando disponibilidade e autorização institucional:

- responsáveis;
- colaboradores de portaria/controle de acesso;
- gestão escolar.

Não é necessário coletar nome, matrícula, CPF, dado de estudante ou qualquer informação sensível para avaliar a interface.

## Cenários mínimos

| Cenário | Perfil principal | Tarefa | Critério de sucesso |
|---|---|---|---|
| V-01 | Responsável | Entrar e localizar a movimentação de um aluno vinculado | Localiza histórico/notificação sem acessar aluno não vinculado |
| V-02 | Portaria | Registrar entrada por token | Entrada salva, auditada e notificação criada |
| V-03 | Portaria | Registrar saída | Saída aceita apenas após entrada válida |
| V-04 | Gestão | Consultar relatório e exportar CSV | Visualiza relatório e obtém CSV autenticado |
| V-05 | Gestão | Consultar trilha de auditoria | Identifica usuário, ação e horário do evento |

## Dados que o módulo Feedback registra

- perfil avaliado;
- cenário/tarefa;
- sucesso da tarefa (sim/não);
- tempo aproximado em segundos;
- nota de 1 a 5;
- comentário livre curto.

## Indicadores

1. **Taxa de sucesso:** tarefas concluídas / tarefas avaliadas.
2. **Tempo médio:** média do tempo informado nas tarefas com tempo válido.
3. **Nota média:** média das avaliações de 1 a 5.
4. **Principais dificuldades:** agrupamento qualitativo dos comentários.
5. **Melhorias priorizadas:** problemas recorrentes que alteram o próximo ciclo do MVP.

## Critérios de aceite propostos

Estes valores são metas do projeto, não resultados já obtidos:

- pelo menos 80% de sucesso nas tarefas essenciais;
- nota média de pelo menos 4,0/5;
- nenhuma violação de RBAC durante o teste;
- nenhuma entrada duplicada aceita;
- nenhuma saída sem entrada anterior aceita;
- CSV acessível somente a sessão autenticada e dentro do escopo do perfil;
- todas as falhas observadas registradas como melhoria, risco ou defeito.

## Procedimento de coleta

1. Restaurar a base de demonstração.
2. Explicar que o ambiente usa somente dados fictícios.
3. Entregar uma tarefa sem indicar passo a passo da solução.
4. Observar se o participante conclui a tarefa e medir o tempo aproximado.
5. Ao final, abrir o menu **Feedback** e registrar a avaliação.
6. Repetir para os demais cenários/perfis.
7. No perfil Gestão, exportar **safe-student-validacao-mvp.csv**.
8. Salvar o CSV como evidência anônima da sessão de validação.
9. Consolidar os indicadores no relatório de pesquisa e no artigo.

## Como relatar resultados

Usar somente valores calculados a partir da exportação real. Exemplo de redação, a ser preenchido após a coleta:

> Foram executadas [N] avaliações em ambiente controlado, distribuídas entre os perfis [PERFIS]. A taxa de conclusão das tarefas foi de [X]%, com nota média [Y]/5 e tempo médio de [Z] segundos. As dificuldades mais recorrentes foram [TEMAS]. Com base nesses achados, a versão seguinte priorizou [MELHORIAS].

Não substituir os campos acima por números inventados.

## Evidências recomendadas para a banca

- CSV exportado do módulo de validação;
- roteiro e termo de participação;
- tabela consolidada sem identificação pessoal;
- capturas do MVP antes/depois das melhorias;
- saída do `npm test` e CI do GitHub Actions;
- matriz de rastreabilidade atualizada.
