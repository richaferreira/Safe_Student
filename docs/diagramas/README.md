# Diagramas V2 — Safe Student

Esta pasta contém a modelagem revisada do Safe Student. Os diagramas foram refeitos após auditoria técnica para eliminar elementos que podiam ser confundidos com fluxograma ou com notação UML incorreta.

## Regras de notação adotadas

- **Casos de uso:** ator e caso de uso são ligados por **associação sólida simples, sem seta**. Não foram adicionados `<<include>>` ou `<<extend>>` sem necessidade semântica real.
- **Classes:** associações são linhas sólidas, com **multiplicidades nas extremidades**. Não há setas de processo. Os perfis do sistema são valores da enumeração `PerfilUsuario`, porque o código utiliza um único objeto `Usuario` com atributo `role`.
- **DER lógico:** tabelas exibem `PK`, `FK` e `UQ`; cada chave estrangeira possui relacionamento correspondente. As ligações representam relacionamentos, **não direção de fluxo**.
- **Sequência:** setas são utilizadas porque, nesse tipo de UML, representam mensagens dirigidas entre participantes; retornos são tracejados.
- **Componentes:** dependências são tracejadas e direcionadas. Apenas componentes e artefatos existentes no MVP são apresentados como implementados.

## Arquivos

1. [`01_uc_responsavel.svg`](01_uc_responsavel.svg) — casos de uso do Responsável.
2. [`02_uc_portaria.svg`](02_uc_portaria.svg) — casos de uso da Portaria.
3. [`03_uc_gestao.svg`](03_uc_gestao.svg) — casos de uso da Gestão Escolar.
4. [`04_classes_nucleo.svg`](04_classes_nucleo.svg) — classes conceituais do núcleo de presença.
5. [`05_classes_suporte.svg`](05_classes_suporte.svg) — comunicação, auditoria e validação.
6. [`06_der_nucleo.svg`](06_der_nucleo.svg) — DER lógico do núcleo de usuários, alunos, turmas, presença e notificações.
7. [`07_der_suporte.svg`](07_der_suporte.svg) — DER lógico de mensagens, auditoria e feedback.
8. [`08_sequencia_presenca.svg`](08_sequencia_presenca.svg) — sequência de registro de entrada/saída.
9. [`09_arquitetura_componentes.svg`](09_arquitetura_componentes.svg) — arquitetura de componentes efetivamente implementada.

## O que deliberadamente não aparece

PostgreSQL/MySQL, Redis, OAuth2/SSO, Docker, SMS/push real, biometria, NFC/RFID, catracas e geolocalização não são desenhados como componentes atuais porque **não existem na implementação do MVP**. Quando mencionados na documentação, são tratados exclusivamente como possibilidades de evolução.

A referência textual oficial desta modelagem é [`../ESPECIFICACAO_REQUISITOS_V2.md`](../ESPECIFICACAO_REQUISITOS_V2.md).
