from pathlib import Path
from docx import Document
from docx.shared import Pt

TOCS = {
    "01_Plano_Gerenciamento_Unificado_Safe_Student.docx": """1 RESUMO EXECUTIVO  ········  4
2 INTRODUÇÃO E JUSTIFICATIVA  ········  4
3 ANÁLISE DE MERCADO  ········  5
4 PERFIL DOS USUÁRIOS E PESQUISA EM CAMPO  ········  7
5 PROTÓTIPOS DE BAIXA E MÉDIA FIDELIDADE  ········  8
6 PROTÓTIPOS DE MÉDIA/ALTA FIDELIDADE  ········  8
7 PROJECT CANVAS  ········  8
8 GERENCIAMENTO DO ESCOPO  ········  9
9 GERENCIAMENTO DO TEMPO  ········  10
10 EQUIPE  ········  12
11 GERENCIAMENTO DAS COMUNICAÇÕES  ········  12
12 PARTES INTERESSADAS  ········  12
13 GERENCIAMENTO DOS RISCOS  ········  13
14 MONITORAMENTO E CONTROLE  ········  14
15 CONTROLE INTEGRADO DE MUDANÇAS  ········  14
16 LIÇÕES APRENDIDAS  ········  14
17 FUNCIONALIDADES ESSENCIAIS DO MVP  ········  14
18 CUSTOS, RECURSOS, INFRAESTRUTURA E AQUISIÇÕES  ········  15
19 CRITÉRIOS DE APROVAÇÃO  ········  15
20 ADEQUAÇÃO ÀS NORMAS E DOCUMENTOS DE REFERÊNCIA  ········  15
REFERÊNCIAS  ········  16""",
    "02_Especificacao_Requisitos_UML_DER_Safe_Student.docx": """1 VISÃO GERAL  ········  4
2 ATORES  ········  4
3 REQUISITOS FUNCIONAIS  ········  4
4 REQUISITOS NÃO FUNCIONAIS  ········  5
5 REGRAS DE NEGÓCIO  ········  5
6 CASOS DE USO  ········  6
7 ARQUITETURA IMPLEMENTADA  ········  6
8 MODELO RELACIONAL PROPOSTO PARA EVOLUÇÃO  ········  7
9 RASTREABILIDADE DAS CINCO FUNÇÕES ESSENCIAIS  ········  7
10 REFERÊNCIAS  ········  7""",
    "04_Plano_Relatorio_Testes_Safe_Student.docx": """1 ESTRATÉGIA  ········  4
2 AMBIENTE  ········  4
3 TESTES AUTOMATIZADOS  ········  4
4 CASOS FUNCIONAIS PARA A BANCA  ········  5
5 RESULTADO E LIMITAÇÕES  ········  5
6 CRITÉRIOS DE ACEITE  ········  5""",
    "05_Relatorio_Pesquisa_Campo_Extensionista_Safe_Student.docx": """1 OBJETIVO  ········  4
2 PROCEDIMENTOS  ········  4
3 INSTRUMENTOS  ········  4
4 PERFIS E MAPAS DE EMPATIA  ········  4
5 AUDITORIA DOS RESULTADOS DECLARADOS NA VERSÃO ANTERIOR  ········  4
6 PROTOCOLO V1.1 PARA NOVA COLETA  ········  5
7 CRITÉRIOS PROPOSTOS  ········  5
8 ENCAMINHAMENTOS  ········  6""",
}


def set_static_toc(path: Path, toc: str) -> None:
    doc = Document(path)
    paras = doc.paragraphs
    toc_index = next((i for i, p in enumerate(paras) if p.text.strip() == "SUMÁRIO"), None)
    if toc_index is None:
        raise RuntimeError(f"SUMÁRIO não encontrado em {path}")

    target = None
    for p in paras[toc_index + 1:]:
        if p.text.strip():
            target = p
            break
    if target is None:
        raise RuntimeError(f"Parágrafo do sumário não encontrado em {path}")

    target.text = toc
    target.alignment = 0
    fmt = target.paragraph_format
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(0)
    fmt.line_spacing = 1.0
    for run in target.runs:
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)

    doc.save(path)
    print(f"Atualizado: {path}")


for filename, toc in TOCS.items():
    set_static_toc(Path(filename), toc)
