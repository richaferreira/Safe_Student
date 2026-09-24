# Safe Student — Evolução Funcional Real do MVP

## 1. Objetivo desta revisão

Esta entrega parte do projeto corrigido recebido e mantém o domínio definido na documentação inicial: Gestão Escolar, Portaria e Responsável; cadastro/vínculos, movimentações de entrada/saída, notificações, comunicação, relatórios/CSV, auditoria, feedback e validação. A evolução não adiciona módulos de ERP escolar, biometria, geolocalização contínua, financeiro, notas ou integrações externas que alterariam o escopo acadêmico.

O trabalho foi direcionado a transformar recursos que existiam apenas como endpoints ou telas simples em fluxos operacionais completos e coerentes entre os três perfis.

## 2. Diagnóstico da base recebida

A base já possuía autenticação, RBAC, estudantes, vínculos, convites, movimentações, notificações, mensagens, relatórios, auditoria e uma suíte de regressão consistente. O principal gargalo era de produto e arquitetura de interface: o cadastro permitia apenas um responsável por operação; a Portaria exigia decisão manual de Entrada/Saída; mensagens eram exibidas como lista; relatórios e auditoria tinham filtros limitados; vários recursos do backend não estavam transformados em uma experiência operacional integrada.

A suíte recebida iniciou esta revisão com 49 testes aprovados.

## 3. Evoluções implementadas

### 3.1 Matrícula integrada com múltiplos responsáveis

O endpoint de criação de estudante aceita `guardians[]`, com até quatro responsáveis na mesma matrícula. Cada item pode apontar para conta ativa existente ou representar um novo responsável que receberá convite de ativação.

Todas as entradas são validadas antes da persistência. Se qualquer responsável for inválido, a matrícula inteira é rejeitada, evitando estudante parcialmente cadastrado. A compatibilidade com o payload legado (`guardianId`/`guardian`) foi mantida.

No frontend, o cadastro virou um fluxo de revisão de matrícula, com inclusão/remoção dinâmica de responsáveis e apresentação dos convites gerados após confirmação.

### 3.2 Central de responsáveis

A Gestão passa a ter visão consolidada de responsáveis, filhos vinculados, situação da conta e convites pendentes. Permanecem disponíveis renovação/revogação de convite e remoção de vínculo conforme as permissões já previstas.

### 3.3 Portaria operacional

Foi criado `GET /api/attendance/lookup?token=...`. Antes de registrar uma movimentação, o servidor retorna o aluno, o estado operacional calculado e a próxima ação válida.

Estados exibidos:
- `SEM_REGISTRO`: nenhuma movimentação no dia; próxima ação ENTRADA.
- `DENTRO`: último evento do dia foi ENTRADA; próxima ação SAÍDA.
- `FORA`: último evento do dia foi SAÍDA; próxima ação ENTRADA.

Esses estados representam somente a sequência de eventos da Portaria; não representam geolocalização em tempo real ou frequência pedagógica.

O operador deixa de escolher manualmente uma ação potencialmente inválida. A interface oferece somente a operação seguinte autorizada pelo estado atual.

### 3.4 QR com fallback manual

O frontend pode usar câmera com `BarcodeDetector` + `getUserMedia` quando o navegador oferecer suporte. O QR contém o token opaco do estudante e não precisa expor nome, turma ou dados familiares. O token digitado permanece como fallback.

O backend registra o método validado (`TOKEN_MANUAL`, `QR_CAMERA` ou `QR_TOKEN`).

### 3.5 Notificações por contexto

Foi criado endpoint de notificações filtrável por não lidas e por estudante, sempre restrito ao usuário autenticado. O responsável pode organizar eventos dos próprios filhos sem receber informações de outras famílias.

### 3.6 Comunicação por conversas

Foi criado `GET /api/messages/conversations`, que agrupa as mensagens existentes por interlocutor. O servidor continua aplicando as regras de destinatários permitidos; o frontend agora apresenta lista de conversas e thread, em vez de uma tabela plana.

### 3.7 Relatórios e CSV coerentes

Relatórios aceitam filtros comuns de período, turma, estudante e tipo (`ENTRADA`/`SAIDA`). A resposta fornece eventos detalhados, resumo por estudante e métricas de movimentação.

A exportação CSV utiliza os mesmos parâmetros e a mesma regra de escopo. Assim, o usuário exporta exatamente o recorte que consultou na tela.

### 3.8 Auditoria pesquisável

A rota de auditoria aceita período, usuário, ação e busca textual. A interface passa a apresentar filtros e catálogo de ações/usuários acessíveis à Gestão.

### 3.9 Sessão web mais protegida

Login e ativação de responsável criam cookie `ss_session` com `HttpOnly` e `SameSite=Strict`. O frontend usa o cookie de mesma origem e não precisa armazenar token de sessão em Web Storage. O mecanismo Bearer foi mantido no backend para compatibilidade com a suíte e chamadas existentes.

### 3.10 Frontend reestruturado

Foram reconstruídos os módulos de Portaria, Alunos, Responsáveis, Notificações, Relatórios, Comunicação e Auditoria. O CSS adicional `public/evolution.css` organiza console operacional, wizard de matrícula, central familiar, mensageria, filtros e comportamento responsivo.

## 4. Validação

Resultado final da suíte automatizada:

- 58 testes executados
- 58 aprovados
- 0 falhas

Foram acrescentados testes específicos para:
- múltiplos responsáveis em uma matrícula;
- atomicidade da matrícula;
- consulta operacional e transição da Portaria;
- filtros de relatório e equivalência do CSV;
- filtros de notificações;
- conversas agrupadas e privacidade;
- filtros da auditoria;
- cookie `HttpOnly`/`SameSite`;
- presença dos novos módulos no frontend.

Além dos testes HTTP/API/domínio, a interface foi exercitada em Chromium headless com respostas de API simuladas para verificar a renderização e o JavaScript dos três perfis. O roteiro terminou sem erros de página ou console. O ambiente de execução usado nesta revisão bloqueou navegação direta do Chromium para `localhost`, portanto essa etapa não é apresentada como E2E navegador-servidor; a integração HTTP real é coberta pela suíte automatizada.

## 5. Arquivos principais alterados

- `server.js`: rotas, filtros, cookie de sessão, matrícula múltipla, Portaria operacional, conversas e auditoria.
- `public/index.html`: módulos e fluxos novos.
- `public/app.js`: integração completa das telas e APIs.
- `public/evolution.css`: layout dos novos módulos.
- `tests/evolution.test.js`: regressões específicas desta evolução.

## 6. O que continua propositalmente fora

Para não sair da documentação inicial, esta entrega não implementa notas/boletim, financeiro, professores como novo ator, biometria, reconhecimento facial, NFC/RFID, catracas, GPS, transporte escolar, WhatsApp/SMS, push externo ou integrações automáticas com ERP/SIS.

Antes de uso real com dados de estudantes ainda são necessários banco transacional, migrations, HTTPS e infraestrutura, recuperação/envio de e-mail real, backups testados, política de retenção/LGPD, homologação institucional, testes de carga e revisão de segurança.


## Perfil individual e histórico organizado

Foi acrescentado um perfil único por aluno. O nome do estudante passa a ser navegável nas áreas operacionais e abre uma visão organizada com dados cadastrais, estado da Portaria, métricas, filtros e linha do tempo. O backend aplica o escopo por papel antes de montar o perfil: Gestão recebe vínculos e eventos administrativos; Portaria não recebe contatos familiares; Responsável só consegue abrir os próprios filhos e somente suas notificações.

A linha do tempo agrega movimentações e, quando autorizado, notificações ou eventos administrativos, sempre ordenados por data. Os filtros por período, tipo e texto são aplicados no servidor.
