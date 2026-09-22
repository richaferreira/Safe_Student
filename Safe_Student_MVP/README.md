# Safe Student — MVP integrado

Projeto demonstrativo de gestão de movimentações escolares, comunicação e acesso familiar. Esta entrega evolui o projeto existente e integra gestão, portaria e responsáveis. **Use exclusivamente dados fictícios. O MVP não está homologado para produção.**

## Sobre a revisão visual desta entrega

A interface foi redesenhada como um sistema visual coeso, substituindo as 5 folhas de estilo sobrepostas (`styles.css`, `styles-academic.css`, `professional.css`, `school-experience.css`, `functional.css`) por duas, bem separadas por responsabilidade:

- `public/professional.css` — variáveis visuais (cor, tipografia, espaçamento, sombra), redefinições e componentes reutilizáveis.
- `public/school-experience.css` — composição de cada tela e toda a responsividade, incluindo o acesso institucional com fotografia escolar local (`public/school-campus.jpg`).

Tipografia baseada na pilha nativa do sistema operacional, sem carregar fontes decorativas ou depender de CDN — compatível com a política de segurança de conteúdo restrita já existente no `server.js`. O login usa a fotografia escolar local colorida em tela cheia, com tratamento escuro transparente apenas para preservar a leitura, pilares funcionais e área de acesso em superfície clara; não há gradientes genéricos, imagens externas ou elementos decorativos sem finalidade. O controle de senha, o estado de carregamento, o tratamento de falha de conexão, o convite e a recuperação de senha dependente da secretaria estão identificados na interface. Nenhuma rota, contrato de API, regra de negócio ou teste foi alterado por essa camada visual; a suíte (`npm test`) permanece verde.

## CPF como identificador adicional do responsável

O e-mail já vinculava automaticamente um novo aluno a um responsável já ativo (sem gerar convite); agora o **CPF** funciona como identificador alternativo, com o mesmo efeito — útil quando a escola cadastra o mesmo responsável com um e-mail diferente do que ele usou para ativar a conta. Implementado em `server.js`:

- Validação de CPF com dígito verificador (`validCpf`), rejeitando sequências repetidas.
- Vínculo automático por e-mail OU CPF nos 3 fluxos de cadastro de responsável (aluno novo, vincular outro responsável, ativação de conta), com a mesma trava de segurança já existente: se o identificador bate mas o nome não, o sistema bloqueia e pede conferência manual.
- CPF sempre mascarado nas telas da gestão (`***.***.321-00`); nunca exposto por completo fora da própria conta do responsável.
- 4 testes novos em `tests/api.test.js` cobrindo cada cenário (vínculo automático, CPF inválido, nome divergente, CPF duplicado na ativação).

O código de convite continua obrigatório na **primeira** ativação de um responsável novo — é o controle que impede que alguém com o CPF ou e-mail de outra pessoa crie uma conta e veja dados do aluno. CPF e e-mail só substituem o convite quando já existe uma conta ativa correspondente.

## Atalho de cadastro no painel

O botão principal do painel ("+ Novo registro") levava sempre para a tela de Presença/Portaria, mesmo para quem está logado como Gestão — cujo cadastro mais comum é de aluno, não de entrada/saída. Agora o botão é sensível ao perfil: para Gestão/Admin ele mostra "Cadastrar aluno" e abre o formulário direto; para Portaria continua "Novo registro", levando à Presença. Lógica em `configureQuickAction()` no `public/app.js`.

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

A aplicação inicia copiando a base inicial `data/db.seed.json` para a base de execução `data/db.runtime.json` se a base mutável ainda não existir. O arquivo de execução é ignorado no Git. **Para atualizar uma instalação existente, faça uma cópia de segurança da sua `data/db.runtime.json` e preserve esse arquivo: não o substitua pela base inicial.** O novo código usa `guardianInvitations` quando disponível e inicializa essa coleção se faltar na base antiga. Cadastros antigos sem vínculo devem ser revisados pela gestão.

Opções de ambiente: `PORT` (3000), `SS_DB_PATH` (caminho da base), `SS_TIME_ZONE` (`America/Sao_Paulo`), `SS_SESSION_TTL_MS` (tempo da sessão). `npm run reset` **apaga os dados locais de demonstração**. Não use esse comando sem uma cópia de segurança.

## Testes executados

`npm test`: **49 testes aprovados, zero falhas** no ambiente desta entrega. A suíte abrange domínio, autenticação, autorização, cadastro obrigatório com responsável, múltiplos filhos, ativação e renovação/revogação de convite, recuperação de senha, sessão atualizada, edição e desativação, notificações, restrição por perfil, filtros de relatório, exportação CSV e regressões de privacidade. A validação desta revisão também gerou capturas para computador e celular em `validation/`, além de verificar HTTP 200 para a interface, CSS e fotografia escolar.

## Limites antes de uma implantação real

Este projeto utiliza armazenamento JSON, sessões em memória e convite entregue manualmente. Ainda são necessários banco transacional e migrações, concorrência entre instâncias, HTTPS/TLS, controle de infraestrutura, cópia de segurança e restauração testadas, envio e verificação de e-mail para convites e recuperação, validação documental do vínculo responsável-aluno, consentimento e governança institucional, políticas de retenção e LGPD, testes de carga, revisão de segurança e homologação com a escola. A recuperação de senha do MVP funciona localmente com código temporário exibido na tela de demonstração; em produção deve ser substituída por entrega via canal institucional. A aprovação da gestão no MVP é uma **simulação do processo de verificação de vínculo**; ter o e-mail ou o convite sozinho não substitui essa conferência operacional.

Os protótipos de imagem são referências visuais; os dados e botões deste projeto são os efetivamente suportados pelo servidor, sem números inventados. Leia `REVISAO_FUNCIONAL.md` para detalhes e pendências.
