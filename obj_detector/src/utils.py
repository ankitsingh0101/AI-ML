"""
utils.py — Shared utility functions used across the pipeline.
"""

import os
import sys
import shutil
import hashlib
import logging
import random
import time
from pathlib import Path
from typing import List, Tuple, Dict, Optional

import cv2
import numpy as np
import yaml

# ─────────────────────────────────────────────
#  Logging
# ─────────────────────────────────────────────

def get_logger(name: str = "obj_detector", level: int = logging.INFO) -> logging.Logger:
    """Return a consistently formatted logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s — %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger


logger = get_logger()

# ─────────────────────────────────────────────
#  Directory helpers
# ─────────────────────────────────────────────

def ensure_dirs(*paths) -> None:
    """Create directories (including parents) if they don't exist."""
    for p in paths:
        Path(p).mkdir(parents=True, exist_ok=True)


def clean_dir(path: Path) -> None:
    """Remove and recreate a directory."""
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
#  Image validation
# ─────────────────────────────────────────────

def is_valid_image(image_path: Path) -> bool:
    """
    Return True if the file is a valid, readable image.
    Checks both file integrity and OpenCV decode.
    """
    try:
        img = cv2.imread(str(image_path))
        if img is None:
            return False
        if img.shape[0] < 32 or img.shape[1] < 32:
            return False
        return True
    except Exception:
        return False


def file_md5(path: Path) -> str:
    """Compute MD5 hash of a file (used to detect duplicates)."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def remove_duplicate_images(image_dir: Path) -> int:
    """
    Scan image_dir for duplicate files by MD5 hash.
    Remove duplicates, keeping the first encountered.
    Returns the number of duplicates removed.
    """
    seen: Dict[str, Path] = {}
    removed = 0
    for img_path in sorted(image_dir.rglob("*")):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
            continue
        md5 = file_md5(img_path)
        if md5 in seen:
            img_path.unlink()
            removed += 1
        else:
            seen[md5] = img_path
    return removed

# ─────────────────────────────────────────────
#  YOLO label helpers
# ─────────────────────────────────────────────

def validate_yolo_label(label_path: Path, num_classes: int) -> Tuple[bool, str]:
    """
    Validate a YOLO-format label file.
    Each line: <class_id> <cx> <cy> <w> <h>  (all normalised 0–1)

    Returns (is_valid, reason).
    """
    if not label_path.exists():
        return False, "file not found"
    lines = label_path.read_text().strip().splitlines()
    if not lines:
        return False, "empty"
    for lineno, line in enumerate(lines, 1):
        parts = line.strip().split()
        if len(parts) != 5:
            return False, f"line {lineno}: expected 5 fields, got {len(parts)}"
        try:
            cls_id = int(parts[0])
            vals   = [float(x) for x in parts[1:]]
        except ValueError:
            return False, f"line {lineno}: non-numeric value"
        if cls_id < 0 or cls_id >= num_classes:
            return False, f"line {lineno}: class_id {cls_id} out of range [0, {num_classes})"
        if any(v < 0.0 or v > 1.0 for v in vals):
            return False, f"line {lineno}: coordinates out of [0, 1] range"
        cx, cy, w, h = vals
        if w <= 0 or h <= 0:
            return False, f"line {lineno}: zero-size box"
    return True, "ok"


def sanitize_dataset(
    images_dir: Path,
    labels_dir: Path,
    num_classes: int,
) -> Tuple[int, int]:
    """
    Remove image/label pairs where either:
      - the image is unreadable / too small
      - the label file is missing or invalid

    Returns (kept, removed) counts.
    """
    kept = removed = 0
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for img_path in sorted(images_dir.rglob("*")):
        if img_path.suffix.lower() not in extensions:
            continue
        label_path = labels_dir / img_path.with_suffix(".txt").name

        valid_img = is_valid_image(img_path)
        valid_lbl, reason = validate_yolo_label(label_path, num_classes)

        if valid_img and valid_lbl:
            kept += 1
        else:
            if not valid_img:
                logger.debug("Removing bad image: %s", img_path.name)
            else:
                logger.debug("Removing bad label (%s): %s", reason, label_path.name)
            img_path.unlink(missing_ok=True)
            label_path.unlink(missing_ok=True)
            removed += 1

    return kept, removed

# ─────────────────────────────────────────────
#  YOLO data.yaml generation
# ─────────────────────────────────────────────

def write_data_yaml(
    yaml_path: Path,
    train_path: Path,
    val_path: Path,
    test_path: Path,
    classes: List[str],
) -> None:
    """Write a Ultralytics-compatible data.yaml file."""
    data = {
        "path":  str(yaml_path.parent.resolve()),
        "train": str(train_path.resolve()),
        "val":   str(val_path.resolve()),
        "test":  str(test_path.resolve()),
        "nc":    len(classes),
        "names": classes,
    }
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    with open(yaml_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    logger.info("data.yaml written -> %s  (%d classes)", yaml_path, len(classes))

# ─────────────────────────────────────────────
#  Drawing / Visualization
# ─────────────────────────────────────────────

# Generate a fixed palette of N visually distinct BGR colours
def _generate_palette(n: int) -> List[Tuple[int, int, int]]:
    random.seed(0)
    palette = []
    for i in range(n):
        hue = int(180 * i / n)
        hsv = np.array([[[hue, 220, 200]]], dtype=np.uint8)
        bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0][0]
        palette.append((int(bgr[0]), int(bgr[1]), int(bgr[2])))
    random.shuffle(palette)
    return palette


def draw_detections(
    frame: np.ndarray,
    boxes: List,          # list of (x1, y1, x2, y2, conf, cls_id)
    class_names: List[str],
    palette: Optional[List[Tuple[int, int, int]]] = None,
    box_thickness: int = 2,
    font_scale: float = 0.55,
    font_thickness: int = 1,
    overlay_alpha: float = 0.35,
) -> np.ndarray:
    """
    Draw bounding boxes and labels on a frame.
    Returns a copy of the frame with overlays.
    """
    if palette is None:
        palette = _generate_palette(len(class_names))

    out = frame.copy()
    for x1, y1, x2, y2, conf, cls_id in boxes:
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        color = palette[cls_id % len(palette)]
        label = f"{class_names[cls_id]}  {conf*100:.0f}%"

        # Bounding box
        cv2.rectangle(out, (x1, y1), (x2, y2), color, box_thickness)

        # Label background
        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
        )
        lx1, ly1 = x1, max(y1 - th - baseline - 4, 0)
        lx2, ly2 = x1 + tw + 4, y1

        overlay = out.copy()
        cv2.rectangle(overlay, (lx1, ly1), (lx2, ly2), color, -1)
        cv2.addWeighted(overlay, overlay_alpha, out, 1 - overlay_alpha, 0, out)

        # Label text (black for readability on the coloured background)
        cv2.putText(
            out, label,
            (x1 + 2, y1 - baseline - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale, (0, 0, 0), font_thickness, cv2.LINE_AA,
        )
    return out


def draw_fps(frame: np.ndarray, fps: float) -> np.ndarray:
    """Overlay FPS counter in the top-left corner."""
    cv2.putText(
        frame, f"FPS: {fps:.1f}",
        (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
        0.9, (0, 255, 0), 2, cv2.LINE_AA,
    )
    return frame

# ─────────────────────────────────────────────
#  FPS counter
# ─────────────────────────────────────────────

class FPSCounter:
    """Rolling-average FPS counter."""

    def __init__(self, window: int = 30):
        self._window = window
        self._times: List[float] = []

    def tick(self) -> float:
        """Call once per frame. Returns current rolling FPS."""
        now = time.perf_counter()
        self._times.append(now)
        if len(self._times) > self._window:
            self._times.pop(0)
        if len(self._times) < 2:
            return 0.0
        elapsed = self._times[-1] - self._times[0]
        return (len(self._times) - 1) / elapsed if elapsed > 0 else 0.0
