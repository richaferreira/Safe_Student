# Verificação dos diagramas do documento 02

Conferência dos cinco diagramas contra o banco (migrações 001 e 002), o código do `main` e as tabelas do documento 02.

## Conteúdo

| Diagrama | O que foi conferido | Resultado |
| --- | --- | --- |
| Casos de uso | Os 12 casos de uso e os atores de cada um batem com as tabelas UC-01 a UC-12; nenhum caso incluído ou estendido tem ator; include vai do caso base para o incluído, extend vai da extensão para o base | Conforme |
| Classes | Atributos contra as colunas; multiplicidades contra os NOT NULL das chaves estrangeiras; enumerações contra o código (turnos, métodos, perfis, status) | Conforme |
| Modelo relacional | 12 tabelas, colunas, PK, 12 FK, UNIQUE e CHECK contra o banco criado pelas migrações | Conforme |
| Sequência | Ordem das mensagens contra `GET /api/attendance/lookup` e `POST /api/attendance` em `src/app.js` | Conforme |
| Componentes | Pastas, arquivos e scripts npm citados existem; serviços e pastas do código aparecem | Conforme |

## Padrão de setas (notação)

| Diagrama | Elemento | Notação usada |
| --- | --- | --- |
| Casos de uso | Associação ator e caso de uso | Linha cheia, sem ponta |
| Casos de uso | `«include»` e `«extend»` | Tracejada com ponta aberta (dependência UML). Include aponta para o caso incluído; extend aponta para o caso base |
| Classes | Associação | Linha cheia, sem ponta, com multiplicidades |
| Sequência | Mensagem síncrona | Linha cheia com ponta fechada |
| Sequência | Retorno | Tracejada com ponta aberta |
| Componentes | Dependência | Tracejada com ponta aberta |
| Modelo relacional | Chave estrangeira | Notação pé de galinha: `||` exatamente um, `o|` zero ou um, `o<` zero ou muitos |

Ajuste de texto: o limite de quatro responsáveis vale só na matrícula (`POST /api/students`); o vínculo posterior (`POST /api/links`) não limita.
