#!/usr/bin/env bash
# Uso: ./commitar.sh /caminho/do/clone/Safe_Student
# Cria o branch correcoes-doc02-mvp com 4 commits. Não faz push.
set -euo pipefail
REPO="${1:?uso: ./commitar.sh /caminho/do/clone/Safe_Student}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"
git rev-parse --is-inside-work-tree >/dev/null
git checkout -b correcoes-doc02-mvp
cp_to() { mkdir -p "$(dirname "$1")"; cp "$HERE/$1" "$1"; }

# 1) perfil ADMIN (RN-17)
for f in src/services/domain.js src/services/accessService.js public/js/core/state.js public/js/core/helpers.js tests/unit/roles.test.js; do cp_to "Safe_Student_MVP/$f"; done
git add Safe_Student_MVP
git commit -m "fix(rn-17): remove o perfil ADMIN das regras e da interface

O CHECK de users.role aceita só GESTAO, PORTARIA e RESPONSAVEL; o código
ainda citava ADMIN em domain.js, accessService.js, state.js e helpers.js."

# 2) RN-14 e RN-15
for f in src/app.js tests/integration/workflows.test.js tests/integration/rules-rn14-rn15.test.js; do cp_to "Safe_Student_MVP/$f"; done
git add Safe_Student_MVP
git commit -m "fix(rn-14,rn-15): turma inativa na edição do aluno e último responsável

- PATCH /api/students recusa transferir o aluno para turma inativa
- DELETE /api/links recusa remover o último responsável (conta ativa ou convite pendente)
- testes novos e teste de vínculo adaptado à RN-15 (84 testes)"

# 3) tela de arquitetura e guia alinhados ao documento 02
for f in public/js/views/architecture.js docs/GUIA_REVISAO_PROFESSOR_BANCA.md; do cp_to "Safe_Student_MVP/$f"; done
git add Safe_Student_MVP
git commit -m "docs: alinha a tela de arquitetura e o guia de revisão ao documento 02

Mesmos casos de uso, include/extend e dicionário de dados do banco SQLite."

# 4) banco fora do versionamento + documentação
git rm --cached --ignore-unmatch Safe_Student_MVP/data/safe_student.db
for f in 00_LEIA_ME_PACOTE_SAFE_STUDENT.txt 01_*.docx 02_*.docx 02_*.pdf 04_*.docx 06_*.docx 07_*.xlsx 08_*.pdf 08_*.pptx 10_*.docx Guia_*.docx; do cp "$HERE"/$f . ; done
cp "$HERE"/slides/* slides/
git add 00_LEIA_ME_PACOTE_SAFE_STUDENT.txt 01_*.docx 02_*.docx 02_*.pdf 04_*.docx 06_*.docx 07_*.xlsx 08_*.pdf 08_*.pptx 10_*.docx Guia_*.docx slides
git commit -m "docs: atualiza documentos 01, 02, 04, 06, 07, 08, 10 e o guia da banca

- diagramas refeitos (casos de uso, classes, relacional, sequência, componentes)
- SQLite no lugar de JSON, contagens de testes e requisitos atualizadas
- remove data/safe_student.db do controle de versão (já está no .gitignore)"
echo "Pronto. Confira com 'git log --oneline -4' e envie com 'git push -u origin correcoes-doc02-mvp'."
