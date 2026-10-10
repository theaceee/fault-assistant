#!/usr/bin/env python3
"""Build the on-device manual index used by the offline assistant.

Usage:
    python3 tools/build_index.py manuals/sample_pump_manual.md
    python3 tools/build_index.py --pdf manuals/long_manual.pdf      # needs: pip install pypdf
    python3 tools/build_index.py manuals/*.md --pdf big.pdf -o app/data/manual.json

Markdown format (structured, preferred — each section has English and Gujarati variants):

    # SECTION: <unique-id>
    tags: comma, separated, keywords (any language)
    ## en
    Title: ...
    Symptoms: ...
    Steps:
    1. ...
    ## gu
    Title: ...
    ...

PDF input is split into page-sized passages (no structure needed), so any long
manual still becomes searchable offline.

The output JSON is self-contained; the web app loads it and never touches the network.
"""
import argparse
import glob
import json
import os
import re
import sys

SECTION_RE = re.compile(r"^#\s*SECTION:\s*(.+?)\s*$")
LANG_RE = re.compile(r"^##\s*(en|gu|hi|mr)\s*$", re.I)


def parse_markdown(path):
    docs = []
    section = None
    lang = None
    cur = None
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("<!--") or not line.strip():
            continue
        m = SECTION_RE.match(line)
        if m:
            section = {"id": m.group(1).strip(), "tags": []}
            lang = None
            cur = None
            continue
        if section is None:
            continue
        if line.lower().startswith("tags:") and lang is None:
            section["tags"] = [t.strip() for t in line.split(":", 1)[1].split(",") if t.strip()]
            continue
        m = LANG_RE.match(line)
        if m:
            lang = m.group(1).lower()
            cur = {"id": f'{section["id"]}:{lang}', "section": section["id"], "lang": lang,
                   "source": os.path.basename(path), "title": "", "symptoms": "",
                   "steps": [], "tags": section["tags"], "kind": "procedure"}
            docs.append(cur)
            continue
        if cur is None:
            continue
        low = line.lower()
        if low.startswith("title:"):
            cur["title"] = line.split(":", 1)[1].strip()
        elif low.startswith("symptoms:"):
            cur["symptoms"] = line.split(":", 1)[1].strip()
        elif low.startswith("steps:"):
            pass
        elif re.match(r"^\d+[.)]\s+", line):
            cur["steps"].append(re.sub(r"^\d+[.)]\s+", "", line).strip())
        else:
            # continuation of previous step / symptom text
            if cur["steps"]:
                cur["steps"][-1] += " " + line.strip()
            else:
                cur["symptoms"] = (cur["symptoms"] + " " + line.strip()).strip()
    for d in docs:
        d["text"] = " ".join([d["title"], d["symptoms"], " ".join(d["steps"])])
    return docs


def parse_pdf(path, chunk_chars=1200):
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("pypdf is required for PDF input: pip install pypdf")
    reader = PdfReader(path)
    docs = []
    base = os.path.splitext(os.path.basename(path))[0]
    for i, page in enumerate(reader.pages, start=1):
        text = re.sub(r"[ \t]+", " ", (page.extract_text() or "")).strip()
        if not text:
            continue
        # split very long pages into chunks so results stay readable
        for j in range(0, len(text), chunk_chars):
            part = text[j:j + chunk_chars]
            n = j // chunk_chars + 1
            docs.append({
                "id": f"{base}:p{i}:{n}", "section": f"{base}-p{i}", "lang": "auto",
                "source": os.path.basename(path), "page": i, "title": f"{base} — page {i}",
                "symptoms": "", "steps": [part], "tags": [], "kind": "passage", "text": part,
            })
    return docs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="*", help="markdown manuals (structured)")
    ap.add_argument("--pdf", action="append", default=[], help="PDF manual(s)")
    ap.add_argument("-o", "--output", default="app/data/manual.json")
    args = ap.parse_args()

    md_files = []
    for pattern in args.inputs:
        md_files.extend(glob.glob(pattern) or [pattern])
    docs = []
    for p in md_files:
        docs.extend(parse_markdown(p))
    for p in args.pdf:
        docs.extend(parse_pdf(p))
    if not docs:
        sys.exit("No documents found. Give at least one manual.")

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "count": len(docs), "docs": docs}, f, ensure_ascii=False, indent=1)
    print(f"Wrote {len(docs)} documents to {args.output}")


if __name__ == "__main__":
    main()
