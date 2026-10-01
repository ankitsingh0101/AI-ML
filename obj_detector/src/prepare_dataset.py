"""
prepare_dataset.py — Prepares the COCO dataset for training.

TWO MODES:

  Mode 1 (default) — Quick test with coco128 (already downloaded):
    python src/prepare_dataset.py --mode coco128

  Mode 2 — Full COCO 2017 (80 classes, ~26 GB, auto-downloads via Ultralytics):
    python src/prepare_dataset.py --mode coco_full

HOW IT WORKS (coco128 mode):
  1. Reads images + labels from dataset/coco128_raw/coco128/
  2. Splits into train (70%) / val (20%) / test (10%)
  3. Copies into dataset/images/ and dataset/labels/
  4. Writes dataset/data.yaml

HOW IT WORKS (coco_full mode):
  - Simply confirms that coco.yaml exists (Ultralytics downloads COCO
    automatically on first model.train(data='coco.yaml') call).
  - No manual download needed.

COCO 80 CLASSES:
  person, bicycle, car, motorcycle, airplane, bus, train, truck, boat,
  traffic light, fire hydrant, stop sign, parking meter, bench, bird,
  cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe, backpack,
  umbrella, handbag, tie, suitcase, frisbee, skis, snowboard, sports ball,
  kite, baseball bat, baseball glove, skateboard, surfboard, tennis racket,
  bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple,
  sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake, chair,
  couch, potted plant, bed, dining table, toilet, tv, laptop, mouse,
  remote, keyboard, cell phone, microwave, oven, toaster, sink,
  refrigerator, book, clock, vase, scissors, teddy bear, hair drier,
  toothbrush
"""

import argparse
import random
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import get_logger, ensure_dirs, write_data_yaml, sanitize_dataset
import config as cfg

logger = get_logger("prepare_dataset")

# ─────────────────────────────────────────────
#  COCO 80 class names (official order)
# ─────────────────────────────────────────────
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
    "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
    "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
    "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet", "tv",
    "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
    "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush",
]


# ─────────────────────────────────────────────
#  Mode 1: coco128 — use the already-downloaded
#          128-image COCO sample
# ─────────────────────────────────────────────

def prepare_coco128():
    """
    Split the coco128 dataset (128 images) into train/val/test
    and write data.yaml pointing at it.
    """
    src_images = cfg.PROJECT_ROOT / "dataset" / "coco128_raw" / "coco128" / "images" / "train2017"
    src_labels = cfg.PROJECT_ROOT / "dataset" / "coco128_raw" / "coco128" / "labels" / "train2017"

    if not src_images.exists():
        logger.error(
            "coco128 not found at %s\n"
            "It should have been downloaded already. Re-run the download script.",
            src_images,
        )
        sys.exit(1)

    img_paths = sorted(src_images.glob("*.jpg"))
    logger.info("coco128: found %d images", len(img_paths))

    # Pair each image with its label
    pairs = []
    for img in img_paths:
        lbl = src_labels / (img.stem + ".txt")
        if lbl.exists():
            pairs.append((img, lbl))
        else:
            logger.warning("No label for %s — skipping", img.name)

    logger.info("Valid image/label pairs: %d", len(pairs))

    # Shuffle + split
    random.seed(cfg.RANDOM_SEED)
    random.shuffle(pairs)
    n = len(pairs)
    n_train = int(n * 0.70)
    n_val   = int(n * 0.20)
    splits = {
        "train": pairs[:n_train],
        "val":   pairs[n_train : n_train + n_val],
        "test":  pairs[n_train + n_val:],
    }

    # Copy into dataset/images/ and dataset/labels/
    for split_name, split_pairs in splits.items():
        img_out = cfg.IMAGES_DIR / split_name
        lbl_out = cfg.LABELS_DIR / split_name
        ensure_dirs(img_out, lbl_out)
        for img_path, lbl_path in split_pairs:
            shutil.copy2(img_path, img_out / img_path.name)
            shutil.copy2(lbl_path, lbl_out / lbl_path.name)
        logger.info("  %-6s %d images", split_name, len(split_pairs))

    # Write data.yaml
    write_data_yaml(
        yaml_path  = cfg.DATA_YAML,
        train_path = cfg.TRAIN_IMAGES,
        val_path   = cfg.VAL_IMAGES,
        test_path  = cfg.TEST_IMAGES,
        classes    = COCO_CLASSES,
    )

    logger.info("Dataset ready. data.yaml -> %s", cfg.DATA_YAML)
    logger.info("NOTE: coco128 has only 128 images — model trains quickly but")
    logger.info("      accuracy will be limited. Use --mode coco_full for real training.")


# ─────────────────────────────────────────────
#  Mode 2: coco_full — let Ultralytics download
#          the full COCO 2017 automatically
# ─────────────────────────────────────────────

def prepare_coco_full():
    """
    Ultralytics will auto-download COCO 2017 on the first train() call
    when data='coco.yaml'. This function just confirms the setup and
    shows instructions.
    """
    logger.info("=" * 60)
    logger.info("FULL COCO 2017 MODE")
    logger.info("=" * 60)
    logger.info("Ultralytics downloads COCO 2017 automatically.")
    logger.info("Just run:")
    logger.info("  python src/train.py --data-mode coco_full")
    logger.info("")
    logger.info("Dataset details:")
    logger.info("  Train images : ~118,000")
    logger.info("  Val images   : ~5,000")
    logger.info("  Classes      : 80")
    logger.info("  Download size: ~26 GB")
    logger.info("  Download time: ~1-3 hours depending on connection")
    logger.info("=" * 60)


# ─────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────

def _parse_args():
    parser = argparse.ArgumentParser(
        description="Prepare dataset for YOLO training."
    )
    parser.add_argument(
        "--mode",
        choices=["coco128", "coco_full"],
        default="coco128",
        help="coco128 = use the 128-image sample (fast, already downloaded).\n"
             "coco_full = use full COCO 2017 (auto-downloads ~26 GB on first train).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    if args.mode == "coco128":
        prepare_coco128()
    else:
        prepare_coco_full()
