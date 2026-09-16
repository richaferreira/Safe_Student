# Safe Student — MVP integrado

Projeto demonstrativo de gestão de movimentações escolares, comunicação e acesso familiar. Esta entrega evolui o projeto existente, mantém a identidade visual aprovada e integra gestão, portaria e responsáveis. **Use exclusivamente dados fictícios. O MVP não está homologado para produção.**

## Iniciar no Windows / PowerShell

Abra a pasta que contém `package.json` e execute:

```powershell
npm test
npm start
```

Acesse `http://localhost:3000`. Requer Node.js 18 ou posterior. Não precisa instalar dependências externas.

Se a porta estiver ocupada, utilize `$env:PORT="3001"; npm start` e acesse `http://localhost:3001`.

## Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Gestão | gestor@demo.com | demo123 |
| Portaria | portaria@demo.com | demo123 |
| Responsável | responsavel@demo.com | demo123 |

Estas credenciais servem **somente** à base fictícia. O login oferece um seletor de contas de demonstração.

## Cadastro integrado — fluxo principal

1. Gestão → Alunos → Novo aluno: preencha nome, matrícula, turma **e responsável** na mesma tela. A API rejeita cadastros sem responsável.
2. Se o responsável já tem conta, selecione-o na opção "Selecionar responsável já ativo", ou forneça seus dados já conferidos pela escola. O estudante é vinculado ao usuário autorizado na mesma gravação.
3. Se não tem conta, informe nome, e-mail, telefone e vínculo. A escola recebe um **código de convite de uso único**, com validade de 30 dias. O código só é exibido na criação ou renovação e é armazenado como hash, nunca em texto puro.
4. A escola deve entregar o convite à pessoa correta por canal institucional conferido. **Não existe envio automático por e-mail** nesta implementação.
5. No login, a pessoa escolhe "Recebeu um convite da escola? Ative sua conta", informa o e-mail, código e cria uma senha. Após a ativação, a sessão é aberta e os filhos vinculados aparecem no painel.
6. Outros estudantes cadastrados pela gestão para a mesma conta aprovada aparecem imediatamente, mesmo em uma sessão já aberta. Novos convites pendentes para o mesmo e-mail são unificados com os vínculos aprovados na ativação.

Se a escola já possui um aluno sem vínculo, use Alunos → Vincular responsável → pessoa existente ou novo convite. Gestão → Responsáveis e convites permite consultar acessos, remover vínculo, renovar ou revogar convites. Um código renovado invalida o anterior.

## O que está operacional

**Gestão:** consultar e pesquisar alunos, matricular com responsável obrigatório, vincular outros responsáveis, editar matrícula/nome/turma, desativar e reativar aluno, consultar contas e convites, renovar/revogar convite, consultar movimentações, registrar entrada/saída, visualizar notificações próprias, trocar mensagens com destinatários permitidos, aplicar filtros de data e turma nos relatórios, exportar CSV filtrado, consultar auditoria e executar validações acadêmicas.

**Portaria:** buscar/selecionar códigos de alunos ativos, registrar entrada/saída, bloquear entradas duplicadas e saídas sem entrada, consultar estudantes e histórico autorizados, consultar relatórios dentro do escopo, comunicar-se apenas com perfis permitidos. A operação envia notificação **interna** aos responsáveis ativos vinculados.

**Responsável:** ativar conta mediante convite previamente criado pela escola, visualizar somente filhos ativos associados à sua conta, consultar último registro e histórico, acessar notificações e marcá-las como lidas, enviar mensagens e consultar relatórios limitados aos seus filhos. Códigos de portaria e dados de outras famílias não são enviados a esse perfil.

**Visão geral:** indicadores, gráfico de movimentações, turmas, histórico recente, mensagens e notificações são alimentados pela API. Entrada/saída de portaria **não comprova frequência em sala ou localização em tempo real**. A interface não fabrica agenda, estatísticas de aprovação nem taxas de presença escolar.

## Persistência e migração

A aplicação inicia copiando `data/db.seed.json` para `data/db.runtime.json` se a base mutável ainda não existe. O arquivo de runtime é ignorado no Git. **Para atualizar uma instalação existente, faça backup da sua `data/db.runtime.json` e preserve esse arquivo: não o substitua pelo seed.** O novo código usa `guardianInvitations` quando disponível e inicializa essa coleção se faltar na base antiga. Cadastros antigos sem vínculo devem ser revisados pela gestão.

Opções de ambiente: `PORT` (3000), `SS_DB_PATH` (caminho da base), `SS_TIME_ZONE` (`America/Sao_Paulo`), `SS_SESSION_TTL_MS` (tempo da sessão). `npm run reset` **apaga os dados locais de demonstração**. Não use esse comando sem backup.

## Testes executados

`npm test`: **44 testes aprovados, zero falhas** no ambiente desta entrega. A suíte abrange domínio, autenticação, autorização, cadastro obrigatório com responsável, múltiplos filhos, ativação e renovação/revogação de convite, sessão atualizada, edição e desativação, notificações, restrição por perfil, filtros de relatório, exportação CSV e regressões de privacidade. Um roteiro adicional automatizado em Chromium com requisições ao back-end verificou os fluxos das três áreas, cadastro/ativação, mensagem, entrada/saída, marcação de notificação, CSV e visualização móvel. Capturas em `previas/`.

## Limites antes de uma implantação real

Este projeto utiliza armazenamento JSON, sessões em memória e convite entregue manualmente. Ainda são necessários banco transacional e migrations, concorrência entre instâncias, HTTPS/TLS, controle de infraestrutura, backup/restauração testados, envio e verificação de e-mail, recuperação de senha, validação documental do vínculo responsável-aluno, consentimento e governança institucional, políticas de retenção e LGPD, testes de carga, revisão de segurança e homologação com a escola. A aprovação da gestão no MVP é uma **simulação do processo de verificação de vínculo**; ter o e-mail ou o convite sozinho não substitui essa conferência operacional.

Os protótipos de imagem são referências visuais; os dados e botões deste projeto são os efetivamente suportados pelo servidor, sem números inventados. Leia `REVISAO_FUNCIONAL.md` para detalhes e pendências.
