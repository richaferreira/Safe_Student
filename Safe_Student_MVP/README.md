# Safe Student MVP

MVP acadêmico demonstrável do projeto Safe Student. A aplicação foi construída para apresentação e validação dos fluxos centrais sem usar dados reais de estudantes.

## Execução

1. Instale Node.js 18 ou superior.
2. Abra um terminal nesta pasta.
3. Execute `npm start`.
4. Acesse `http://localhost:3000`.

Não há dependências externas e não é necessário executar `npm install`.

## Perfis de apresentação

| Perfil | E-mail | Senha | Principais capacidades |
|---|---|---|---|
| Responsável | responsavel@demo.com | demo123 | alunos vinculados, notificações, histórico, relatórios, mensagens |
| Portaria | portaria@demo.com | demo123 | registro de entrada/saída e consulta operacional |
| Gestão | gestor@demo.com | demo123 | cadastros, vínculos, presença, relatórios, auditoria e reset da demo |

Tokens de apresentação: `SS-ALU001`, `SS-ALU002`, `SS-ALU003`, `SS-ALU004`.

## Funcionalidades

- autenticação com sessão temporária e senha armazenada por hash;
- autorização por perfil (RBAC) no servidor;
- cadastro de aluno de apresentação e vínculo com responsável;
- registro de entrada/saída por QR/token simulado;
- validação de sequência entrada → saída;
- notificações automáticas ao responsável;
- histórico e relatório por aluno;
- exportação CSV;
- comunicação para apresentação escola-família;
- trilha de auditoria para gestão;
- reset da base de apresentação;
- layout responsivo, navegação por teclado e tema claro/escuro;
- cabeçalhos básicos de segurança no servidor.

## Testes

Execute `npm test`. Os testes cobrem regras de RBAC, sequência de presença, cálculo de apresentação e hash/verificação de senha.

## Limitações deliberadas

Este é um MVP acadêmico, não uma aplicação pronta para produção. Usa arquivo JSON como persistência local; não possui HTTPS próprio, banco relacional, serviço real de push/SMS, SSO, observabilidade corporativa ou rotina de backup. Biometria, NFC, catracas e geolocalização contínua ficam fora do escopo do MVP.

Para produção, migrar a persistência para PostgreSQL/MySQL, usar HTTPS/TLS, segredo de sessão externo, política de retenção, monitoramento, backups, testes de segurança, gestão de incidentes, DPIA/RIPD quando aplicável e validação institucional/jurídica.


## Validação acadêmica

O menu Feedback permite registrar avaliações de apresentação por perfil, gerando indicadores simples para a banca. Antes de uso real, substitua os dados de teste por coleta autorizada pela instituição.
