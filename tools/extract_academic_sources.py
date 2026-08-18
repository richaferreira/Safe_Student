#!/usr/bin/env python3
"""Extrai texto de artefatos acadêmicos binários para auditoria temporária.

Usado apenas durante a revisão do projeto. Não altera os documentos originais.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "_extracted"
OUT.mkdir(parents=True, exist_ok=True)

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def clean(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(f"{W}body")
    lines: list[str] = []
    if body is None:
        return ""
    for child in body:
        if child.tag == f"{W}p":
            text = "".join(t.text or "" for t in child.iter(f"{W}t"))
            if text.strip():
                lines.append(text.strip())
        elif child.tag == f"{W}tbl":
            for tr in child.findall(f"{W}tr"):
                cells = []
                for tc in tr.findall(f"{W}tc"):
                    txt = " ".join((t.text or "") for t in tc.iter(f"{W}t"))
                    cells.append(re.sub(r"\s+", " ", txt).strip())
                if any(cells):
                    lines.append(" | ".join(cells))
    return clean("\n".join(lines))


def pptx_text(path: Path) -> str:
    lines: list[str] = []
    with zipfile.ZipFile(path) as z:
        names = sorted(
            (n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"(\d+)", Path(n).stem).group(1)),
        )
        for idx, name in enumerate(names, 1):
            root = ET.fromstring(z.read(name))
            texts = [t.text or "" for t in root.iter(f"{A}t")]
            lines.append(f"\n=== SLIDE {idx} ===")
            lines.extend(t.strip() for t in texts if t.strip())
    return clean("\n".join(lines))


def xlsx_text(path: Path) -> str:
    lines: list[str] = []
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{S}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{S}t")))
        workbook = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rel_ns = "{http://schemas.openxmlformats.org/package/2006/relationships}"
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels.findall(f"{rel_ns}Relationship")}
        r_id = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        sheets = workbook.find(f"{S}sheets")
        if sheets is None:
            return ""
        for sheet in sheets.findall(f"{S}sheet"):
            name = sheet.attrib.get("name", "Sheet")
            target = rel_map.get(sheet.attrib.get(r_id, ""), "")
            if not target:
                continue
            normalized = target.lstrip("/")
            sheet_path = normalized if normalized.startswith("xl/") else f"xl/{normalized}"
            root = ET.fromstring(z.read(sheet_path))
            lines.append(f"\n=== PLANILHA: {name} ===")
            for row in root.iter(f"{S}row"):
                vals = []
                for c in row.findall(f"{S}c"):
                    cell_type = c.attrib.get("t")
                    v = c.find(f"{S}v")
                    value = "" if v is None else (v.text or "")
                    if cell_type == "s" and value.isdigit():
                        i = int(value)
                        value = shared[i] if 0 <= i < len(shared) else value
                    elif cell_type == "inlineStr":
                        value = "".join(t.text or "" for t in c.iter(f"{S}t"))
                    vals.append(value)
                if any(v.strip() for v in vals):
                    lines.append(" | ".join(vals))
    return clean("\n".join(lines))


def pdf_text(path: Path) -> str:
    exe = shutil.which("pdftotext")
    if not exe:
        return "pdftotext indisponível no runner.\n"
    proc = subprocess.run([exe, "-layout", str(path), "-"], check=True, capture_output=True)
    return clean(proc.stdout.decode("utf-8", errors="replace"))


def extract(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return docx_text(path)
    if suffix == ".pdf":
        return pdf_text(path)
    if suffix == ".xlsx":
        return xlsx_text(path)
    if suffix == ".pptx":
        return pptx_text(path)
    return path.read_text(encoding="utf-8", errors="replace")


def main() -> None:
    patterns = ["*.docx", "*.pdf", "*.xlsx", "*.pptx"]
    files = []
    for pattern in patterns:
        files.extend(ROOT.glob(pattern))
    files = sorted(set(files))
    index = ["# Extração temporária para auditoria", "", "Arquivos originais não foram alterados.", ""]
    for path in files:
        ok = OUT / f"{path.name}.txt"
        err = OUT / f"{path.name}.ERROR.txt"
        try:
            text = extract(path)
            ok.write_text(text, encoding="utf-8")
            if err.exists():
                err.unlink()
            index.append(f"- `{path.name}` -> `{ok.relative_to(ROOT)}`")
        except Exception as exc:
            if ok.exists():
                ok.unlink()
            err.write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
            index.append(f"- ERRO `{path.name}` -> `{err.relative_to(ROOT)}`")
    (OUT / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
