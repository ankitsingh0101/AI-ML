#!/usr/bin/env python3
"""Sloth Sorter: a lazy, local-AI file tidier.

Scans a messy folder, asks a local open-weight model (Gemma via Ollama)
where each file belongs and what to call it, shows a dry-run plan, and
only moves files when you pass --apply. Every move is logged so you can
--undo it. Nothing ever leaves your machine.
"""
import argparse
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "gemma3:4b"
UNDO_LOG = ".sloth_undo.json"
CATEGORIES = ["Documents", "Images", "Videos", "Audio", "Archives",
              "Code", "Installers", "Finance", "Study", "Other"]
TEXT_EXTS = {".txt", ".md", ".csv", ".json", ".py", ".js", ".html", ".log"}

EXT_FALLBACK = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"},
    "Videos": {".mp4", ".mkv", ".mov", ".avi"},
    "Audio": {".mp3", ".wav", ".flac", ".m4a"},
    "Archives": {".zip", ".rar", ".7z", ".tar", ".gz"},
    "Installers": {".exe", ".msi", ".dmg", ".deb", ".apk"},
    "Code": {".py", ".js", ".ts", ".java", ".c", ".cpp", ".html", ".css"},
    "Documents": {".pdf", ".doc", ".docx", ".txt", ".md", ".ppt", ".pptx"},
    "Finance": {".xls", ".xlsx", ".csv"},
}


def fallback_category(path: Path) -> str:
    """Extension-based guess, used when the model is unavailable."""
    for cat, exts in EXT_FALLBACK.items():
        if path.suffix.lower() in exts:
            return cat
    return "Other"


def preview(path: Path, limit: int = 600) -> str:
    """Short text preview for plain-text files (helps the model decide)."""
    if path.suffix.lower() not in TEXT_EXTS:
        return ""
    try:
        return path.read_text(errors="ignore")[:limit]
    except OSError:
        return ""


def ask_model(path: Path, model: str):
    """Ask the local model for a category and a clean filename."""
    prompt = (
        "You organise files. Pick ONE category from this list: "
        f"{', '.join(CATEGORIES)}.\n"
        "Category guide: Finance = bills, invoices, bank statements, budgets. "
        "Study = course notes, exam prep, textbooks, assignments. "
        "Documents = resumes, letters, reports, general documents. "
        "Code = source code and scripts. "
        "Other = personal lists, ideas, anything that fits nowhere else.\n"
        "Also suggest a short, descriptive, lowercase-with-dashes filename "
        "WITHOUT the extension, based on what the content is about. "
        "Never use a generic name like 'notes', 'doc', 'copy' or 'new' "
        "on its own; say what the file is about.\n"
        f"File name: {path.name}\n"
        f"Content preview: {preview(path) or '(not available)'}\n"
        'Reply ONLY with JSON: {"category": "...", "name": "..."}'
    )
    body = json.dumps({
        "model": model, "prompt": prompt, "stream": False,
        "format": "json", "options": {"temperature": 0.2},
    }).encode()
    req = urllib.request.Request(
        OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(json.loads(resp.read())["response"])
    category = data.get("category", "Other")
    if category not in CATEGORIES:
        category = "Other"
    name = re.sub(r"[^a-z0-9\-_]+", "-", str(data.get("name", "")).lower())
    name = name.strip("-")[:60]
    return category, name


def unique_path(dest: Path) -> Path:
    """Never overwrite: add -1, -2... if the target exists."""
    if not dest.exists():
        return dest
    i = 1
    while True:
        candidate = dest.with_name(f"{dest.stem}-{i}{dest.suffix}")
        if not candidate.exists():
            return candidate
        i += 1


def build_plan(folder: Path, model: str, use_ai: bool):
    plan, ai_ok = [], use_ai
    files = sorted(p for p in folder.iterdir()
                   if p.is_file() and not p.name.startswith("."))
    for f in files:
        category, name = fallback_category(f), ""
        if ai_ok:
            try:
                category, name = ask_model(f, model)
            except Exception as exc:  # model offline, bad JSON, etc.
                print(f"! Model unavailable ({exc.__class__.__name__}); "
                      "using extension rules instead.")
                ai_ok = False
        new_name = (name + f.suffix.lower()) if name else f.name
        dest = unique_path(folder / category / new_name)
        plan.append((f, dest))
    return plan


def apply_plan(plan, folder: Path):
    moves = []
    for src, dest in plan:
        dest.parent.mkdir(exist_ok=True)
        shutil.move(str(src), str(dest))
        moves.append({"from": str(src), "to": str(dest)})
    (folder / UNDO_LOG).write_text(json.dumps(moves, indent=2))
    print(f"\nMoved {len(moves)} files. Undo anytime with --undo.")


def undo(folder: Path):
    log = folder / UNDO_LOG
    if not log.exists():
        sys.exit("Nothing to undo.")
    moves = json.loads(log.read_text())
    for m in reversed(moves):
        if Path(m["to"]).exists():
            shutil.move(m["to"], m["from"])
    for d in folder.iterdir():  # remove now-empty category folders
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    log.unlink()
    print(f"Restored {len(moves)} files.")


def main():
    ap = argparse.ArgumentParser(description="Lazy local-AI file tidier.")
    ap.add_argument("folder", type=Path, help="folder to tidy")
    ap.add_argument("--apply", action="store_true",
                    help="actually move files (default is a dry run)")
    ap.add_argument("--undo", action="store_true", help="revert last run")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--no-ai", action="store_true",
                    help="skip the model, sort by extension only")
    args = ap.parse_args()

    if not args.folder.is_dir():
        sys.exit(f"Not a folder: {args.folder}")
    if args.undo:
        return undo(args.folder)

    plan = build_plan(args.folder, args.model, not args.no_ai)
    if not plan:
        return print("Nothing to sort. Sloth approves.")
    print(f"\nPlan for {args.folder}:\n")
    for src, dest in plan:
        print(f"  {src.name}  ->  {dest.relative_to(args.folder)}")
    if args.apply:
        apply_plan(plan, args.folder)
    else:
        print("\nDry run only. Re-run with --apply to move files.")


if __name__ == "__main__":
    main()
