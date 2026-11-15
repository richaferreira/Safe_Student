# Fontes dos diagramas

Os PNGs usados no documento 02 e no dossiê são gerados por estes scripts. Para alterar um diagrama,
edite o script, rode `bash gerar_todos.sh` e troque a imagem no documento (clique com o botão direito na figura
e escolha "Alterar imagem").

| Diagrama | Script | O que editar |
| --- | --- | --- |
| Casos de uso | `fig1.py` | chamadas `uc(...)` (casos de uso), `assoc` (quem usa o quê) e `dep(...)` (include e extend) |
| Classes | `fig2.py` | chamadas `cls(...)` (classes e atributos) e as linhas `ln(...)` (associações e multiplicidades) |
| Modelo relacional | `fig3.py` | dicionário `T` (tabelas e colunas) e a lista `fk` (chaves estrangeiras) |
| Sequência | `fig4.py` | chamadas `msg(...)` na ordem em que acontecem |
| Componentes | `fig5.py` | texto do Graphviz (`dot`) dentro do script |

Requisitos: Python 3, `pip install matplotlib pillow` e Graphviz (comando `dot`).
O modelo relacional deve sempre bater com `Safe_Student_MVP/src/database/migrations`.
