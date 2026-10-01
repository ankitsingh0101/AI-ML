"""
train.py — Fine-tune YOLOv8 on the 110-class Open Images dataset.

USAGE:
    python src/train.py [options]

    # Quick test (20 epochs, small batch):
    python src/train.py --epochs 20 --batch-size 8 --device cpu

    # Full training on GPU:
    python src/train.py --epochs 50 --batch-size 32 --device 0

    # Resume interrupted training:
    python src/train.py --resume

OUTPUTS saved to outputs/training/yolov8n_openimages_110cls/:
    weights/best.pt     ← best checkpoint (copy also saved to models/best.pt)
    weights/last.pt     ← final checkpoint
    results.csv         ← per-epoch metrics
    confusion_matrix.png
    PR_curve.png, P_curve.png, R_curve.png, F1_curve.png
    train_batch*.jpg    ← augmented training examples
    val_batch*.jpg      ← validation predictions
"""

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils import get_logger, ensure_dirs
import config as cfg

logger = get_logger("train")


# ─────────────────────────────────────────────
#  Ultralytics import guard
# ─────────────────────────────────────────────
try:
    from ultralytics import YOLO
except ImportError:
    logger.error(
        "ultralytics is not installed.  Run:  pip install ultralytics"
    )
    sys.exit(1)


# ─────────────────────────────────────────────
#  Pre-flight checks
# ─────────────────────────────────────────────

def preflight_check() -> None:
    """Abort early with a clear message if the dataset is not ready."""
    if not cfg.DATA_YAML.exists():
        logger.error(
            "data.yaml not found at %s\n"
            "Run prepare_dataset.py first:\n"
            "    python src/prepare_dataset.py",
            cfg.DATA_YAML,
        )
        sys.exit(1)

    for split in ("train", "val"):
        img_dir = cfg.IMAGES_DIR / split
        lbl_dir = cfg.LABELS_DIR / split
        if not img_dir.exists() or not any(img_dir.iterdir()):
            logger.error(
                "No images found in %s\n"
                "Run prepare_dataset.py first.",
                img_dir,
            )
            sys.exit(1)
        if not lbl_dir.exists() or not any(lbl_dir.iterdir()):
            logger.error(
                "No labels found in %s\n"
                "Run prepare_dataset.py first.",
                lbl_dir,
            )
            sys.exit(1)

    # Count samples
    n_train = len(list((cfg.IMAGES_DIR / "train").glob("*")))
    n_val   = len(list((cfg.IMAGES_DIR / "val").glob("*")))
    logger.info("Dataset OK — train: %d  val: %d", n_train, n_val)


# ─────────────────────────────────────────────
#  Training
# ─────────────────────────────────────────────

def train(
    epochs: int       = cfg.TRAIN_EPOCHS,
    img_size: int     = cfg.TRAIN_IMG_SIZE,
    batch_size: int   = cfg.TRAIN_BATCH_SIZE,
    lr0: float        = cfg.TRAIN_LR0,
    lrf: float        = cfg.TRAIN_LRF,
    device: str       = cfg.TRAIN_DEVICE,
    workers: int      = cfg.TRAIN_WORKERS,
    patience: int     = cfg.TRAIN_PATIENCE,
    cache: bool       = cfg.TRAIN_CACHE,
    amp: bool         = cfg.TRAIN_AMP,
    resume: bool      = False,
    weights: str      = cfg.PRETRAINED_WEIGHTS,
    data_mode: str    = "coco128",
) -> Path:
    """
    Fine-tune YOLOv8 on the prepared dataset.

    data_mode:
      "coco128"   — use dataset/data.yaml (prepared by prepare_dataset.py)
      "coco_full" — use Ultralytics built-in coco.yaml (auto-downloads ~26 GB)

    Returns path to the best saved weights.
    """
    ensure_dirs(cfg.MODELS_DIR, cfg.TRAINING_OUT)

    # Choose data source
    if data_mode == "coco_full":
        data_src = "coco.yaml"   # Ultralytics auto-downloads COCO 2017
        logger.info("Using full COCO 2017 (auto-download via coco.yaml)")
    else:
        data_src = str(cfg.DATA_YAML)
        if not cfg.DATA_YAML.exists():
            logger.error(
                "data.yaml not found. Run first:\n  python src/prepare_dataset.py"
            )
            import sys; sys.exit(1)

    # ── Load model ──────────────────────────────────────────────
    if resume:
        # Resume from the last checkpoint if it exists
        last_run = Path(cfg.TRAINING_OUT) / cfg.TRAIN_NAME / "weights" / "last.pt"
        if last_run.exists():
            logger.info("Resuming training from %s", last_run)
            model = YOLO(str(last_run))
        else:
            logger.warning(
                "No checkpoint found at %s — starting fresh.", last_run
            )
            model = YOLO(weights)
    else:
        logger.info("Loading pretrained weights: %s", weights)
        model = YOLO(weights)

    # ── Print model summary ──────────────────────────────────────
    logger.info("Model: %s  |  Classes: %d  |  Device: %s",
                weights, cfg.NUM_CLASSES, device or "auto")
    logger.info(
        "Training config: epochs=%d  img_size=%d  batch=%d  lr0=%.4f  patience=%d",
        epochs, img_size, batch_size, lr0, patience,
    )

    # ── Train ────────────────────────────────────────────────────
    results = model.train(
        data       = data_src,
        epochs     = epochs,
        imgsz      = img_size,
        batch      = batch_size,
        lr0        = lr0,
        lrf        = lrf,
        momentum   = cfg.TRAIN_MOMENTUM,
        weight_decay = cfg.TRAIN_WEIGHT_DECAY,
        warmup_epochs = cfg.TRAIN_WARMUP_EPOCHS,
        patience   = patience,
        workers    = workers,
        device     = device if device else None,
        project    = str(cfg.TRAINING_OUT),
        name       = cfg.TRAIN_NAME,
        exist_ok   = cfg.TRAIN_EXIST_OK,
        pretrained = cfg.TRAIN_PRETRAINED,
        optimizer  = cfg.TRAIN_OPTIMIZER,
        cache      = cache,
        amp        = amp,
        resume     = resume,
        plots      = True,   # Save PR/confusion matrix plots
        save       = True,   # Save best/last weights
        val        = True,   # Run validation after each epoch
        verbose    = True,
    )

    # ── Copy best weights to models/ ─────────────────────────────
    run_dir    = Path(cfg.TRAINING_OUT) / cfg.TRAIN_NAME
    best_src   = run_dir / "weights" / "best.pt"
    last_src   = run_dir / "weights" / "last.pt"

    if best_src.exists():
        shutil.copy2(best_src, cfg.BEST_MODEL_PATH)
        logger.info("Best model saved → %s", cfg.BEST_MODEL_PATH)
    else:
        logger.warning("best.pt not found at %s", best_src)

    if last_src.exists():
        shutil.copy2(last_src, cfg.LAST_MODEL_PATH)
        logger.info("Last model saved → %s", cfg.LAST_MODEL_PATH)

    # ── Summary ──────────────────────────────────────────────────
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("Training complete.")
    logger.info("Results directory : %s", run_dir)
    logger.info("Best weights      : %s", cfg.BEST_MODEL_PATH)
    logger.info("Last weights      : %s", cfg.LAST_MODEL_PATH)
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    return cfg.BEST_MODEL_PATH


# ─────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune YOLOv8 on COCO 80-class dataset."
    )
    parser.add_argument("--epochs",      type=int,   default=cfg.TRAIN_EPOCHS,
                        help=f"Training epochs (default: {cfg.TRAIN_EPOCHS})")
    parser.add_argument("--img-size",    type=int,   default=cfg.TRAIN_IMG_SIZE,
                        help=f"Input image size (default: {cfg.TRAIN_IMG_SIZE})")
    parser.add_argument("--batch-size",  type=int,   default=cfg.TRAIN_BATCH_SIZE,
                        help=f"Batch size (default: {cfg.TRAIN_BATCH_SIZE})")
    parser.add_argument("--lr",          type=float, default=cfg.TRAIN_LR0,
                        help=f"Initial learning rate (default: {cfg.TRAIN_LR0})")
    parser.add_argument("--device",      type=str,   default=cfg.TRAIN_DEVICE,
                        help='Device: "" = auto, "cpu", "0" = GPU 0')
    parser.add_argument("--workers",     type=int,   default=cfg.TRAIN_WORKERS,
                        help=f"DataLoader workers (default: {cfg.TRAIN_WORKERS})")
    parser.add_argument("--patience",    type=int,   default=cfg.TRAIN_PATIENCE,
                        help=f"Early stopping patience (0=off, default: {cfg.TRAIN_PATIENCE})")
    parser.add_argument("--weights",     type=str,   default=cfg.PRETRAINED_WEIGHTS,
                        help=f"Base pretrained weights (default: {cfg.PRETRAINED_WEIGHTS})")
    parser.add_argument("--cache",       action="store_true",
                        help="Cache images in RAM for faster training")
    parser.add_argument("--no-amp",      action="store_true",
                        help="Disable Automatic Mixed Precision (AMP)")
    parser.add_argument("--resume",      action="store_true",
                        help="Resume training from last checkpoint")
    parser.add_argument("--data-mode",   type=str, default="coco128",
                        choices=["coco128", "coco_full"],
                        help="coco128=use prepared 128-img dataset, coco_full=auto-download full COCO 2017")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.data_mode == "coco128":
        preflight_check()

    train(
        epochs     = args.epochs,
        img_size   = args.img_size,
        batch_size = args.batch_size,
        lr0        = args.lr,
        device     = args.device,
        workers    = args.workers,
        patience   = args.patience,
        cache      = args.cache,
        amp        = not args.no_amp,
        resume     = args.resume,
        weights    = args.weights,
        data_mode  = args.data_mode,
    )
