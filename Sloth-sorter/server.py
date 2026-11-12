"""Local API for the Sloth Sorter UI.

Run:  python -m uvicorn server:app --port 8000
Only listens on localhost. Files and model both stay on your machine.
"""
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sloth_sorter as ss

MODEL = os.environ.get("SLOTH_MODEL", ss.DEFAULT_MODEL)

app = FastAPI(title="Sloth Sorter API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def clean_folder(raw: str) -> Path:
    """Accept pasted Windows paths (with quotes), refuse risky targets."""
    folder = Path(raw.strip().strip('"').strip("'")).expanduser()
    if not folder.is_dir():
        raise HTTPException(400, f"Not a folder: {folder}")
    folder = folder.resolve()
    if folder == Path(folder.anchor):
        raise HTTPException(400, "Refusing to sort a drive root.")
    return folder


PICKER_SCRIPT = """
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askdirectory(title='Choose a folder to tidy', mustexist=True)
root.destroy()
print(path)
"""


def pick_folder() -> str:
    """Open the native folder picker (in its own process) and return the path."""
    out = subprocess.run([sys.executable, "-c", PICKER_SCRIPT],
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "picker failed")
    path = out.stdout.strip()
    return str(Path(path)) if path else ""


class ScanReq(BaseModel):
    folder: str
    use_ai: bool = True


class FileItem(BaseModel):
    original: str
    category: str
    newName: str
    selected: bool = True


class ApplyReq(BaseModel):
    folder: str
    files: List[FileItem]


class UndoReq(BaseModel):
    folder: str


@app.get("/api/status")
def status():
    """Is Ollama reachable, and is our model pulled?"""
    try:
        with urllib.request.urlopen(
                "http://localhost:11434/api/tags", timeout=3) as resp:
            names = [m["name"] for m in json.loads(resp.read())["models"]]
    except Exception:
        return {"connected": False, "model": MODEL, "reason": "ollama-offline"}
    installed = any(n == MODEL or n.split(":")[0] == MODEL for n in names)
    return {"connected": installed, "model": MODEL,
            "reason": None if installed else "model-not-pulled"}


@app.post("/api/browse")
def browse():
    """Let the user pick a folder with the native dialog. '' means cancelled."""
    try:
        return {"folder": pick_folder()}
    except Exception:
        raise HTTPException(
            500, "Could not open the folder picker. Paste the path instead.")


@app.post("/api/scan")
def scan(req: ScanReq):
    folder = clean_folder(req.folder)
    plan = ss.build_plan(folder, MODEL, req.use_ai)
    files = [{
        "id": str(i),
        "original": src.name,
        "category": dest.parent.name,
        "destination": dest.parent.name,
        "newName": dest.name,
        "selected": True,
    } for i, (src, dest) in enumerate(plan)]
    return {"folder": str(folder), "files": files}


@app.post("/api/apply")
def apply(req: ApplyReq):
    folder = clean_folder(req.folder)
    plan = []
    for item in req.files:
        if not item.selected:
            continue
        if item.category not in ss.CATEGORIES:
            raise HTTPException(400, f"Unknown category: {item.category}")
        src = folder / Path(item.original).name  # name only, no traversal
        if not src.is_file():
            continue
        new_name = Path(item.newName).name
        plan.append((src, ss.unique_path(folder / item.category / new_name)))
    if not plan:
        raise HTTPException(400, "Nothing to move.")
    ss.apply_plan(plan, folder)
    return {"moved": len(plan)}


@app.post("/api/undo")
def undo(req: UndoReq):
    folder = clean_folder(req.folder)
    try:
        ss.undo(folder)
    except SystemExit as exc:
        raise HTTPException(400, str(exc))
    return {"folder": str(folder), "restored": True}