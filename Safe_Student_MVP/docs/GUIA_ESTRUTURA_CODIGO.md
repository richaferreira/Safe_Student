# Guia da Estrutura de Código — Safe Student

Este guia explica a responsabilidade dos arquivos do MVP em uma linguagem compatível com uma apresentação universitária de Engenharia de Software.

## Raiz do projeto

### `server.js`
É o ponto de entrada. Cria o servidor HTTP e utiliza o `handler` definido em `src/app.js`. Foi mantido pequeno para não misturar inicialização com regras de negócio.

### `package.json`
Define informações do projeto e comandos de execução, testes e restauração da base de demonstração.

### `README.md`
Explica objetivo, execução, estrutura e limites do MVP.

### `INICIAR_AQUI.txt`
Versão resumida das instruções para quem receber o ZIP e quiser executar rapidamente.

## Backend — `src/`

### `src/app.js`
Roteador central da API. As rotas estão agrupadas por assunto: autenticação, painel, alunos, portaria, relatórios, comunicação, validação acadêmica e gestão.

O arquivo continua central porque o projeto usa apenas Node.js nativo, sem Express ou outro framework. As regras auxiliares foram retiradas dele para evitar concentração excessiva de responsabilidades.

### `src/config/index.js`
Centraliza porta, fuso horário, tempo de sessão e caminhos utilizados pelo sistema.

### `src/database/connection.js`
Abre a conexão com o SQLite e habilita `foreign_keys`, WAL e tempo de espera para bloqueios locais. O restante do projeto não precisa conhecer detalhes da conexão.

### `src/database/migrationRunner.js`
Localiza e executa os arquivos SQL de migration ainda não aplicados. A tabela `schema_migrations` registra o histórico do schema.

### `src/database/migrations/001_initial_schema.sql`
Define as tabelas, índices, chaves estrangeiras, restrições `UNIQUE` e regras `CHECK` da primeira estrutura relacional.

### `src/database/repositories/databaseRepository.js`
Converte as tabelas relacionais em um objeto agregado compatível com os serviços existentes e também grava esse agregado de volta usando uma única transação. É a camada de compatibilidade usada para migrar sem reescrever as regras já testadas.

### `src/database/repository.js`
É a fachada de persistência usada pela aplicação. Oferece leitura, gravação, seed, reset e inicialização do banco sem expor SQLite para `src/app.js`.

### `src/http/response.js`
Contém funções para resposta JSON, exportação CSV e leitura segura do corpo das requisições.

### `src/http/staticFiles.js`
Entrega HTML, CSS, JavaScript e imagens do frontend. Também aplica cabeçalhos básicos de segurança.

### `src/auth/state.js`
Mantém as estruturas em memória usadas por sessões, tentativas de login e redefinições de senha.

### `src/auth/session.js`
Controla cookie de sessão, autenticação da requisição, renovação da sessão e limitação básica de tentativas de login.

### `src/services/domain.js`
Contém regras de domínio reutilizáveis, como permissões por perfil, escopo de alunos e validação da sequência ENTRADA/SAÍDA.

### `src/services/security.js`
Responsável pelo hash de senha, verificação de senha e geração de token aleatório.

### `src/services/studentService.js`
Agrupa consultas e regras auxiliares de aluno: turma, token, estado operacional e composição da visão do aluno.

### `src/services/guardianService.js`
Agrupa regras de responsáveis e criação de convites de ativação.

### `src/services/accessService.js`
Define escopo e acesso aos dados conforme o perfil autenticado.

### `src/services/auditService.js`
Cria eventos de auditoria para ações importantes.

### `src/services/filterService.js`
Valida os filtros usados em relatório e histórico individual do aluno.

### `src/services/feedbackService.js`
Prepara as avaliações da validação acadêmica sem expor campos legados de identificação.

### `src/utils/validation.js`
Valida e normaliza e-mail, CPF, nomes e códigos temporários.

### `src/utils/dateTime.js`
Padroniza datas do sistema utilizando o fuso horário configurado para a escola.

## Frontend — `public/`

### `public/index.html`
Estrutura principal da interface. O MVP usa uma única página e alterna as áreas por JavaScript.

### `public/css/professional.css`
Variáveis visuais, tipografia, botões, formulários, tabelas e componentes compartilhados.

### `public/css/school-experience.css`
Layout das páginas, login, sidebar, dashboard e responsividade.

### `public/css/evolution.css`
Estilos dos módulos adicionados nas evoluções do MVP, como matrícula integrada, comunicação e histórico individual.

### `public/assets/school-campus.jpg`
Imagem local usada no login. Fica dentro do projeto para não depender de serviço externo.

## JavaScript compartilhado — `public/js/core/`

### `state.js`
Variáveis compartilhadas entre as telas e metadados da navegação.

### `helpers.js`
Formatação, ícones, mensagens visuais e armazenamento local seguro.

### `api.js`
Comunicação do navegador com a API e download de arquivos.

### `navigation.js`
Alternância entre telas, aplicação das permissões visuais e atualização do contexto do usuário.

### `auth.js`
Login, restauração da sessão e logout local.

### `events.js`
Associa botões, formulários e outros elementos HTML às funções do sistema.

### `search.js`
Executa a busca global e apresenta resultados permitidos ao usuário.

### `main.js`
Inicializa o frontend após o carregamento dos arquivos anteriores.

## Telas — `public/js/views/`

### `dashboard.js`
Indicadores, ações rápidas, pendências, gráfico e visão geral.

### `students.js`
Listagem, filtros, matrícula integrada e edição de alunos.

### `studentProfile.js`
Perfil individual, timeline, filtros e histórico completo do aluno.

### `guardians.js`
Central de responsáveis, filhos vinculados e convites.

### `presence.js`
Console da Portaria, consulta do aluno, registro de movimentação e leitura de QR.

### `notifications.js`
Listagem e filtros de notificações internas.

### `reports.js`
Relatórios operacionais, resumo por aluno e exportação.

### `messages.js`
Conversas e mensagens entre os perfis autorizados.

### `auditFeedback.js`
Auditoria da gestão e resultados da validação acadêmica.

## Dados — `data/`

### `db.seed.json`
Base fictícia original usada para restaurar a demonstração.

### `safe_student.db`
Banco SQLite mutável utilizado na execução local. O arquivo é criado automaticamente e está no `.gitignore`, pois pode ser reconstruído pelas migrations e pelo seed.

### `db.seed.json`
Continua no projeto somente como fixture fictícia para popular o banco de demonstração. Ele não é mais a persistência principal da aplicação.

## Scripts — `scripts/`

### `db-migrate.js`
Aplica as migrations pendentes.

### `db-seed.js`
Carrega os dados fictícios no banco existente.

### `db-reset.js`
Remove o banco local, reaplica o schema e restaura o seed.

### `db-status.js`
Exibe um resumo das tabelas e quantidades de registros.

### `migrate-json-to-sqlite.js`
Importa uma base do formato JSON anterior para as tabelas SQLite.

### `reset-demo.js`
Alias mantido para compatibilidade com o comando usado nas versões anteriores.

## Testes — `tests/`

### `tests/unit/domain.test.js`
Testa regras de domínio isoladamente.

### `tests/unit/security.test.js`
Testa hash, verificação de senha e tokens.

### `tests/integration/api.test.js`
Testa endpoints principais e controle de acesso.

### `tests/integration/evolution.test.js`
Testa as funcionalidades adicionadas durante a evolução do MVP.

### `tests/integration/workflows.test.js`
Testa fluxos completos envolvendo Gestão, Responsável e Portaria.

### `tests/integration/privacy-regression.test.js`
Garante que mudanças não abram acesso indevido a dados de outros usuários.

### `tests/integration/sqlite.test.js`
Verifica migrations, seed, restrições `UNIQUE`, chaves estrangeiras, rollback transacional e confirma que o arquivo gerado é SQLite real.

## Critério dos comentários

Os comentários foram escritos em PT-BR e usados principalmente para explicar:

- decisões de arquitetura;
- regras de segurança;
- regras de negócio;
- limitações do MVP;
- trechos que poderiam gerar dúvida durante a leitura.

Não foi adotado o padrão de comentar cada linha, porque comentários óbvios aumentam o arquivo sem melhorar a compreensão do código.
