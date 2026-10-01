"""
detect_webcam.py — Real-time object detection from webcam using the trained model.

USAGE:
    python src/detect_webcam.py [options]

    # Use best trained model (default):
    python src/detect_webcam.py

    # Use a specific model with custom threshold:
    python src/detect_webcam.py --model models/best.pt --conf 0.45

    # Use higher resolution for better accuracy:
    python src/detect_webcam.py --img-size 1280

KEYBOARD CONTROLS:
    Q         — Quit
    S         — Save current annotated frame to outputs/detections/
    +         — Increase confidence threshold by 0.05
    -         — Decrease confidence threshold by 0.05
    F         — Toggle fullscreen
    H         — Toggle help overlay

OVERLAY (per detection):
    ┌─────────────────────────┐
    │ Person  96%             │
    │ Laptop  91%             │
    │ Bottle  87%             │
    └─────────────────────────┘
    FPS shown top-left in green.
    Confidence threshold shown top-right.

WEBCAM ERROR HANDLING:
    - Retries webcam open up to 3 times before aborting.
    - Handles frame read failures with a visible error overlay.
    - Gracefully exits on model/camera errors.
"""

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

# Allow running from repo root or from src/
sys.path.insert(0, str(Path(__file__).resolve().parent))

import cv2

from utils import get_logger, ensure_dirs, draw_detections, draw_fps, FPSCounter, _generate_palette
import config as cfg

logger = get_logger("detect_webcam")


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
#  Webcam helpers
# ─────────────────────────────────────────────

def open_webcam(
    index: int   = cfg.WEBCAM_INDEX,
    width: int   = cfg.WEBCAM_WIDTH,
    height: int  = cfg.WEBCAM_HEIGHT,
    retries: int = 3,
) -> cv2.VideoCapture:
    """
    Open the webcam with retries.  Raises RuntimeError if all attempts fail.
    """
    for attempt in range(1, retries + 1):
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            cap.set(cv2.CAP_PROP_FPS,          cfg.WEBCAM_FPS_CAP)
            # Verify it actually reads a frame
            ok, _ = cap.read()
            if ok:
                actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                logger.info(
                    "Webcam opened (index=%d, %dx%d)", index, actual_w, actual_h
                )
                return cap
        cap.release()
        logger.warning("Webcam open attempt %d/%d failed — retrying …", attempt, retries)
        time.sleep(1.0)

    raise RuntimeError(
        f"Could not open webcam (index={index}) after {retries} attempts.\n"
        "Check that a camera is connected and not in use by another application."
    )


def draw_conf_indicator(frame, conf_thresh: float) -> None:
    """Draw the current confidence threshold in the top-right corner."""
    h, w = frame.shape[:2]
    label = f"Conf: {conf_thresh:.2f}"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.putText(
        frame, label,
        (w - tw - 10, 30),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA,
    )


def draw_help_overlay(frame) -> None:
    """Draw keyboard shortcuts overlay in bottom-left corner."""
    h, w = frame.shape[:2]
    lines = [
        "Q: Quit        S: Save frame",
        "+/-: Conf ±0.05  F: Fullscreen",
        "H: Toggle help",
    ]
    y = h - 20
    for line in reversed(lines):
        cv2.putText(
            frame, line,
            (10, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA,
        )
        y -= 22


def draw_error_frame(frame, message: str) -> None:
    """Overlay a red error message over the frame."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h // 2 - 30), (w, h // 2 + 30), (0, 0, 180), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    cv2.putText(
        frame, f"ERROR: {message}",
        (20, h // 2 + 10),
        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA,
    )


def save_frame(frame, output_dir: Path) -> Path:
    """Save the annotated frame to disk with a timestamp filename."""
    ensure_dirs(output_dir)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    out_path = output_dir / f"detection_{ts}.jpg"
    cv2.imwrite(str(out_path), frame)
    logger.info("Frame saved → %s", out_path)
    return out_path


# ─────────────────────────────────────────────
#  Main detection loop
# ─────────────────────────────────────────────

def run_webcam(
    model_path:     Path  = cfg.BEST_MODEL_PATH,
    conf_threshold: float = cfg.CONF_THRESHOLD,
    iou_threshold:  float = cfg.IOU_THRESHOLD,
    img_size:       int   = cfg.TRAIN_IMG_SIZE,
    device:         str   = cfg.TRAIN_DEVICE,
    webcam_index:   int   = cfg.WEBCAM_INDEX,
    max_detections: int   = cfg.MAX_DETECTIONS,
) -> None:
    """
    Main loop: opens webcam, runs YOLOv8 inference on every frame,
    draws bounding boxes + labels + FPS, handles keyboard input.
    """
    ensure_dirs(cfg.DETECTIONS_OUT)

    # ── Load model ──────────────────────────────────────────────
    if not Path(model_path).exists():
        logger.error(
            "Model weights not found: %s\n"
            "Options:\n"
            "  1. Train the model first: python src/train.py\n"
            "  2. Specify a model path:  python src/detect_webcam.py --model path/to/model.pt\n"
            "  3. Use pretrained COCO model (80 classes): python src/detect_webcam.py --model yolov8n.pt",
            model_path,
        )
        sys.exit(1)

    logger.info("Loading model: %s", model_path)
    model  = YOLO(str(model_path))
    names  = model.names   # dict {idx: class_name}
    n_cls  = len(names)
    palette = _generate_palette(n_cls)
    logger.info("Model loaded — %d classes", n_cls)

    # ── Open webcam ──────────────────────────────────────────────
    try:
        cap = open_webcam(index=webcam_index)
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    # ── State ────────────────────────────────────────────────────
    fps_counter    = FPSCounter(window=30)
    conf           = conf_threshold
    show_help      = False
    fullscreen     = False
    consecutive_failures = 0
    MAX_FAILURES         = 10

    window_name = "AI Object Detector — 110 Classes  (Q=quit  S=save  H=help)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, cfg.WEBCAM_WIDTH, cfg.WEBCAM_HEIGHT)

    logger.info("Starting real-time detection. Press Q to quit.")

    # ── Main loop ────────────────────────────────────────────────
    while True:
        ok, frame = cap.read()

        if not ok:
            consecutive_failures += 1
            logger.warning(
                "Frame read failed (%d/%d)", consecutive_failures, MAX_FAILURES
            )
            if consecutive_failures >= MAX_FAILURES:
                logger.error(
                    "Webcam stopped returning frames after %d attempts. Exiting.",
                    MAX_FAILURES,
                )
                break
            # Brief pause and retry
            time.sleep(0.05)
            continue

        consecutive_failures = 0  # Reset on success

        # ── Inference ─────────────────────────────────────────
        try:
            results = model.predict(
                source=frame,
                conf=conf,
                iou=iou_threshold,
                imgsz=img_size,
                max_det=max_detections,
                device=device if device else None,
                verbose=False,
                stream=False,
            )
        except Exception as e:
            logger.warning("Inference error: %s", e)
            draw_error_frame(frame, str(e)[:80])
            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break
            continue

        # ── Parse detections ───────────────────────────────────
        boxes_for_draw = []
        result = results[0]
        if result.boxes is not None and len(result.boxes):
            xyxy   = result.boxes.xyxy.cpu().numpy()    # (N, 4)
            confs  = result.boxes.conf.cpu().numpy()    # (N,)
            cls_ids = result.boxes.cls.cpu().numpy().astype(int)  # (N,)
            for i in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[i]
                boxes_for_draw.append((x1, y1, x2, y2, float(confs[i]), int(cls_ids[i])))

        # ── Draw detections ────────────────────────────────────
        annotated = draw_detections(
            frame=frame,
            boxes=boxes_for_draw,
            class_names=[names[i] for i in range(n_cls)],
            palette=palette,
            box_thickness=cfg.BOX_THICKNESS,
            font_scale=cfg.FONT_SCALE,
            font_thickness=cfg.FONT_THICKNESS,
            overlay_alpha=cfg.OVERLAY_ALPHA,
        )

        # ── FPS / conf overlay ─────────────────────────────────
        fps = fps_counter.tick()
        draw_fps(annotated, fps)
        draw_conf_indicator(annotated, conf)
        if show_help:
            draw_help_overlay(annotated)

        # ── Detection count ────────────────────────────────────
        cv2.putText(
            annotated,
            f"Objects: {len(boxes_for_draw)}",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2, cv2.LINE_AA,
        )

        cv2.imshow(window_name, annotated)

        # ── Key handling ───────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:           # Q or ESC — Quit
            logger.info("Quit key pressed.")
            break

        elif key == ord("s"):                       # S — Save frame
            save_frame(annotated, cfg.DETECTIONS_OUT)

        elif key == ord("+") or key == ord("="):    # + — Increase conf
            conf = min(conf + 0.05, 0.95)
            logger.info("Confidence threshold → %.2f", conf)

        elif key == ord("-"):                       # - — Decrease conf
            conf = max(conf - 0.05, 0.05)
            logger.info("Confidence threshold → %.2f", conf)

        elif key == ord("f"):                       # F — Fullscreen toggle
            fullscreen = not fullscreen
            if fullscreen:
                cv2.setWindowProperty(
                    window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN
                )
            else:
                cv2.setWindowProperty(
                    window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL
                )

        elif key == ord("h"):                       # H — Help overlay toggle
            show_help = not show_help

    # ── Cleanup ──────────────────────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()
    logger.info("Webcam released. Goodbye.")


# ─────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Real-time 110-class object detection from webcam."
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=cfg.BEST_MODEL_PATH,
        help=f"Path to model weights (default: {cfg.BEST_MODEL_PATH})",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=cfg.CONF_THRESHOLD,
        help=f"Detection confidence threshold (default: {cfg.CONF_THRESHOLD})",
    )
    parser.add_argument(
        "--iou",
        type=float,
        default=cfg.IOU_THRESHOLD,
        help=f"NMS IoU threshold (default: {cfg.IOU_THRESHOLD})",
    )
    parser.add_argument(
        "--img-size",
        type=int,
        default=cfg.TRAIN_IMG_SIZE,
        help=f"Inference image size (default: {cfg.TRAIN_IMG_SIZE})",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=cfg.TRAIN_DEVICE,
        help='Device: "" = auto, "cpu", "0" = GPU 0',
    )
    parser.add_argument(
        "--webcam",
        type=int,
        default=cfg.WEBCAM_INDEX,
        help=f"Webcam device index (default: {cfg.WEBCAM_INDEX})",
    )
    parser.add_argument(
        "--max-det",
        type=int,
        default=cfg.MAX_DETECTIONS,
        help=f"Maximum detections per frame (default: {cfg.MAX_DETECTIONS})",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    run_webcam(
        model_path     = args.model,
        conf_threshold = args.conf,
        iou_threshold  = args.iou,
        img_size       = args.img_size,
        device         = args.device,
        webcam_index   = args.webcam,
        max_detections = args.max_det,
    )
