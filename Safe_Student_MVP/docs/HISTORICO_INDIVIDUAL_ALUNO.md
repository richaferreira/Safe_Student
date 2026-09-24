# Histórico individual do aluno

Esta evolução adiciona ao Safe Student um perfil individual do aluno, aberto ao clicar no nome do estudante nas principais áreas do sistema.

## Pontos de acesso

O perfil pode ser aberto pelo Dashboard, lista de alunos, console da Portaria, Central de Responsáveis, Relatórios, Notificações e busca global. O botão Voltar retorna ao contexto anterior; como os filtros permanecem nos controles da tela, consultas de Alunos e Relatórios não são perdidas durante a navegação.

## Conteúdo do perfil

O cabeçalho apresenta nome, matrícula, turma, status cadastral e situação operacional derivada do último evento da Portaria. Abaixo são exibidos indicadores de movimentações, entradas e saídas e uma linha do tempo organizada por data.

A linha do tempo pode ser filtrada por período, tipo de movimento e texto. As abas permitem consultar movimentações em tabela e, conforme a permissão, responsáveis, notificações do próprio responsável e trilha administrativa.

## Privacidade por perfil

**Gestão:** pode consultar movimentações, responsáveis vinculados ou convidados e eventos administrativos relacionados ao aluno.

**Portaria:** pode consultar o histórico operacional e o token necessário à operação, mas não recebe e-mail ou telefone de responsáveis e não visualiza notificações privadas ou auditoria administrativa.

**Responsável:** abre somente os próprios filhos, não recebe token de portaria, não visualiza outros responsáveis e pode consultar apenas as notificações da própria conta relacionadas àquele filho.

## Limite semântico

`DENTRO*`, `FORA*` e `SEM REGISTRO` representam somente o último evento da Portaria no dia. Não indicam geolocalização em tempo real nem frequência em sala.

## Validação

Na etapa do histórico individual foram validados 62 testes. Após a migração para SQLite, a suíte passou a possuir 68 testes aprovados e zero falhas. Quatro testes específicos cobrem o perfil individual: visão da Gestão, privacidade da Portaria, escopo do Responsável e presença da navegação no frontend.
