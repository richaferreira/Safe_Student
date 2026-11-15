# Verificação dos diagramas do documento 02

Conferência dos cinco diagramas contra o banco (migrações 001 e 002), o código (commit do main) e as tabelas do documento 02.

| Diagrama | O que foi conferido | Resultado |
| --- | --- | --- |
| Casos de uso | Os 12 casos de uso e os atores de cada um batem com as tabelas UC-01 a UC-12; nenhum caso incluído ou estendido tem ator; include vai do caso base para o incluído, extend vai da extensão para o base; setas tracejadas com ponta aberta | Conforme |
| Classes | Atributos de cada classe contra as colunas; multiplicidades contra NOT NULL das chaves estrangeiras; enumerações contra o código (turnos, métodos, perfis, status) | Conforme, após acrescentar a enumeração TurnoTurma |
| Modelo relacional | 12 tabelas, colunas, PK, FK (12), UNIQUE e CHECK contra o banco criado pelas migrações | Conforme |
| Sequência | Ordem das mensagens contra `GET /api/attendance/lookup` e `POST /api/attendance` em `src/app.js` | Conforme, após incluir a releitura do banco no POST, a verificação de perfil e a nota sobre 403 e 404 |
| Componentes | Pastas, arquivos e scripts npm citados existem; serviços e pastas do código aparecem | Conforme, após incluir `src/http`, `src/config`, `src/utils` e `filterService` |

Ajuste de texto: o limite de quatro responsáveis vale só na matrícula (`POST /api/students`); o vínculo posterior (`POST /api/links`) não limita.
