"""
evaluate.py — Comprehensive model evaluation: mAP, per-class metrics,
confusion matrix, PR curves, and poor-performing class report.

USAGE:
    python src/evaluate.py [--model models/best.pt] [--split test]

OUTPUTS saved to outputs/evaluation/:
    metrics_summary.txt         — Overall mAP@50, mAP@50-95, P, R
    per_class_metrics.csv       — Per-class AP50, AP50-95, P, R
    poor_performing_classes.txt — Classes with AP50 < threshold
    confusion_matrix.png        — Copied from training output
    (PR curves also available in training output directory)
"""

import argparse
import csv
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils import get_logger, ensure_dirs
import config as cfg

logger = get_logger("evaluate")


try:
    from ultralytics import YOLO
    import numpy as np
except ImportError as e:
    logger.error("Missing dependency: %s.  Run: pip install ultralytics numpy", e)
    sys.exit(1)


# ─────────────────────────────────────────────
#  Evaluation
# ─────────────────────────────────────────────

def evaluate(
    model_path: Path = cfg.BEST_MODEL_PATH,
    split: str       = "test",
    img_size: int    = cfg.EVAL_IMG_SIZE,
    batch_size: int  = cfg.EVAL_BATCH_SIZE,
    conf: float      = cfg.EVAL_CONF,
    iou: float       = cfg.EVAL_IOU,
    device: str      = cfg.TRAIN_DEVICE,
    save_json: bool  = cfg.EVAL_SAVE_JSON,
    plots: bool      = cfg.EVAL_PLOTS,
) -> None:
    """
    Evaluate the trained model on a dataset split.

    Reports:
    - Precision, Recall, mAP@50, mAP@50-95  (overall and per-class)
    - Confusion matrix (saved as PNG)
    - Identifies poorly-performing classes (AP50 < threshold)
    """
    ensure_dirs(cfg.EVALUATION_OUT)

    # ── Load model ──────────────────────────────────────────────
    if not Path(model_path).exists():
        logger.error(
            "Model not found: %s\n"
            "Run train.py first, or specify --model path/to/weights.pt",
            model_path,
        )
        sys.exit(1)

    logger.info("Loading model: %s", model_path)
    model = YOLO(str(model_path))

    # ── Select split image directory ─────────────────────────────
    split_map = {
        "train": cfg.TRAIN_IMAGES,
        "val":   cfg.VAL_IMAGES,
        "test":  cfg.TEST_IMAGES,
    }
    if split not in split_map:
        logger.error("Unknown split '%s'. Choose from: train, val, test", split)
        sys.exit(1)

    data_source = cfg.DATA_YAML  # Ultralytics val uses data.yaml
    logger.info("Evaluating on split: %s", split)
    logger.info(
        "Config: img_size=%d  batch=%d  conf=%.3f  iou=%.2f",
        img_size, batch_size, conf, iou,
    )

    # ── Run validation ────────────────────────────────────────────
    results = model.val(
        data      = str(data_source),
        split     = split,
        imgsz     = img_size,
        batch     = batch_size,
        conf      = conf,
        iou       = iou,
        device    = device if device else None,
        save_json = save_json,
        plots     = plots,
        project   = str(cfg.EVALUATION_OUT),
        name      = f"eval_{split}",
        verbose   = True,
    )

    # ── Extract metrics ───────────────────────────────────────────
    # Ultralytics returns a DetMetrics object; access via .results_dict
    metrics = results.results_dict if hasattr(results, "results_dict") else {}

    overall_p      = float(metrics.get("metrics/precision(B)", 0))
    overall_r      = float(metrics.get("metrics/recall(B)", 0))
    overall_map50  = float(metrics.get("metrics/mAP50(B)", 0))
    overall_map95  = float(metrics.get("metrics/mAP50-95(B)", 0))

    logger.info("=" * 60)
    logger.info("EVALUATION RESULTS — Split: %s", split.upper())
    logger.info("=" * 60)
    logger.info("  Precision  : %.4f", overall_p)
    logger.info("  Recall     : %.4f", overall_r)
    logger.info("  mAP@50     : %.4f", overall_map50)
    logger.info("  mAP@50-95  : %.4f", overall_map95)
    logger.info("=" * 60)

    # ── Per-class metrics ─────────────────────────────────────────
    # Ultralytics stores per-class AP in results.box.maps (array indexed by class)
    per_class_ap50    = None
    per_class_ap5095  = None
    per_class_p       = None
    per_class_r       = None

    box_metrics = getattr(results, "box", None)
    if box_metrics is not None:
        # .maps  = per-class mAP@50:95
        # .ap50  = per-class AP@50
        # .ap    = per-class AP@50:95
        per_class_ap5095 = getattr(box_metrics, "maps",  None)
        per_class_ap50   = getattr(box_metrics, "ap50",  None)
        _p_all           = getattr(box_metrics, "p",     None)
        _r_all           = getattr(box_metrics, "r",     None)
        # p / r are shape [nc, num_thresholds]; take the value at the best
        # threshold index (argmax of F1) or simply the mean
        if _p_all is not None and len(_p_all.shape) == 2:
            per_class_p = _p_all[:, 0]   # column 0 ~ high-conf threshold
            per_class_r = _r_all[:, 0]
        elif _p_all is not None:
            per_class_p = _p_all
            per_class_r = _r_all

    # Write per-class CSV
    csv_path = cfg.EVALUATION_OUT / f"per_class_metrics_{split}.csv"
    poor_classes = []

    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["class_id", "class_name", "AP@50", "AP@50-95", "Precision", "Recall"])

        for idx, class_name in enumerate(cfg.CLASSES):
            ap50   = float(per_class_ap50[idx])   if per_class_ap50   is not None else float("nan")
            ap5095 = float(per_class_ap5095[idx]) if per_class_ap5095 is not None else float("nan")
            p_val  = float(per_class_p[idx])      if per_class_p      is not None else float("nan")
            r_val  = float(per_class_r[idx])      if per_class_r      is not None else float("nan")
            writer.writerow([idx, class_name,
                             f"{ap50:.4f}", f"{ap5095:.4f}",
                             f"{p_val:.4f}", f"{r_val:.4f}"])

            if ap50 < cfg.POOR_PERF_MAP50_THRESHOLD:
                poor_classes.append((class_name, ap50, ap5095))

    logger.info("Per-class metrics saved → %s", csv_path)

    # ── Poor-performing classes report ────────────────────────────
    poor_path = cfg.EVALUATION_OUT / f"poor_performing_classes_{split}.txt"
    poor_classes.sort(key=lambda x: x[1])  # sort by AP50 ascending

    with open(poor_path, "w") as f:
        f.write(f"Classes with AP@50 < {cfg.POOR_PERF_MAP50_THRESHOLD:.2f}\n")
        f.write(f"(Evaluated on '{split}' split)\n")
        f.write("=" * 50 + "\n")
        for cls_name, ap50, ap5095 in poor_classes:
            f.write(f"  {cls_name:<35}  AP@50={ap50:.4f}  AP@50-95={ap5095:.4f}\n")
        if not poor_classes:
            f.write("  All classes meet the performance threshold.\n")

    logger.info("Poor-performing classes (%d) → %s", len(poor_classes), poor_path)
    if poor_classes:
        logger.warning(
            "%d classes perform below AP@50=%.2f threshold: %s",
            len(poor_classes),
            cfg.POOR_PERF_MAP50_THRESHOLD,
            [c[0] for c in poor_classes[:10]],
        )

    # ── Summary text file ─────────────────────────────────────────
    summary_path = cfg.EVALUATION_OUT / f"metrics_summary_{split}.txt"
    with open(summary_path, "w") as f:
        f.write(f"Model        : {model_path}\n")
        f.write(f"Split        : {split}\n")
        f.write(f"Num classes  : {cfg.NUM_CLASSES}\n")
        f.write(f"Img size     : {img_size}\n")
        f.write(f"Conf thresh  : {conf}\n")
        f.write(f"IoU thresh   : {iou}\n")
        f.write("─" * 40 + "\n")
        f.write(f"Precision    : {overall_p:.4f}\n")
        f.write(f"Recall       : {overall_r:.4f}\n")
        f.write(f"mAP@50       : {overall_map50:.4f}\n")
        f.write(f"mAP@50-95    : {overall_map95:.4f}\n")
        f.write("─" * 40 + "\n")
        f.write(f"Poor classes : {len(poor_classes)} / {cfg.NUM_CLASSES}\n")

    logger.info("Summary saved → %s", summary_path)

    # ── Print per-class table ─────────────────────────────────────
    logger.info("\nPer-class AP@50 (sorted):")
    logger.info("  %-35s  %s", "Class", "AP@50")
    logger.info("  " + "─" * 45)

    if per_class_ap50 is not None:
        sorted_cls = sorted(
            enumerate(cfg.CLASSES),
            key=lambda x: float(per_class_ap50[x[0]]),
            reverse=True,
        )
        for idx, cls_name in sorted_cls:
            ap50 = float(per_class_ap50[idx])
            flag = " ⚠" if ap50 < cfg.POOR_PERF_MAP50_THRESHOLD else ""
            logger.info("  %-35s  %.4f%s", cls_name, ap50, flag)
    else:
        logger.warning("Per-class AP not available (run with plots=True for full results).")

    logger.info("\nEvaluation complete. Results in %s", cfg.EVALUATION_OUT)


# ─────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate trained YOLOv8 model on 110-class dataset."
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=cfg.BEST_MODEL_PATH,
        help=f"Path to model weights (default: {cfg.BEST_MODEL_PATH})",
    )
    parser.add_argument(
        "--split",
        type=str,
        default="test",
        choices=["train", "val", "test"],
        help="Dataset split to evaluate on (default: test)",
    )
    parser.add_argument(
        "--img-size", type=int, default=cfg.EVAL_IMG_SIZE,
        help=f"Inference image size (default: {cfg.EVAL_IMG_SIZE})",
    )
    parser.add_argument(
        "--batch-size", type=int, default=cfg.EVAL_BATCH_SIZE,
        help=f"Evaluation batch size (default: {cfg.EVAL_BATCH_SIZE})",
    )
    parser.add_argument(
        "--conf", type=float, default=cfg.EVAL_CONF,
        help=f"Confidence threshold (default: {cfg.EVAL_CONF})",
    )
    parser.add_argument(
        "--iou", type=float, default=cfg.EVAL_IOU,
        help=f"IoU threshold (default: {cfg.EVAL_IOU})",
    )
    parser.add_argument(
        "--device", type=str, default=cfg.TRAIN_DEVICE,
        help='Device: "" = auto, "cpu", "0" = GPU 0',
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    evaluate(
        model_path = args.model,
        split      = args.split,
        img_size   = args.img_size,
        batch_size = args.batch_size,
        conf       = args.conf,
        iou        = args.iou,
        device     = args.device,
    )
