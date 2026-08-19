# Status da publicação binária V2

A revisão técnica V2 está integrada à `main` como fonte canônica em código, Markdown e diagramas SVG. Os arquivos Office/PDF da raiz são gerados a partir dos scripts em `tools/` pelo workflow `Publicar pacote acadêmico V2` quando o evento de publicação é executado pelo GitHub Actions.

## Fonte de verdade antes da geração dos binários

- `docs/ESPECIFICACAO_REQUISITOS_V2.md`
- `docs/diagramas/*.svg`
- `docs/AUDITORIA_SENIOR_V2.md`
- `ACADEMIC_COMPLIANCE.md`
- `Safe_Student_MVP/`

## Validação realizada durante a revisão

- suíte local: 24/24 testes aprovados em Node.js 22;
- inspeção visual local da especificação V2: 25 páginas;
- inspeção visual local do Plano V2, relatório de testes V2, auditoria V2 e manual V2;
- inspeção visual local da apresentação V2: 10 slides;
- diagramas revisados individualmente para notação, legibilidade e coerência.

## Observação de evidência

A pesquisa de campo permanece **Parcial** até existir evidência primária real. Resultados históricos sem formulários/CSV verificável não devem ser apresentados como auditados.
