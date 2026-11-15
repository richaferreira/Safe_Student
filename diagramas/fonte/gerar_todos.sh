#!/usr/bin/env bash
# Regera os cinco diagramas em PNG e copia para a pasta diagramas/.
# Requisitos: Python 3 com matplotlib e pillow (pip install matplotlib pillow) e Graphviz (comando dot).
set -euo pipefail
cd "$(dirname "$0")"
for n in fig1 fig2 fig3 fig4 fig5; do python3 $n.py > /dev/null; done
cp fig1_casos_de_uso.png fig2_classes.png fig3_er.png fig4_sequencia.png fig5_componentes.png ..
rm -f fig*.png fig*.dot
echo "Diagramas atualizados em $(cd .. && pwd)"
