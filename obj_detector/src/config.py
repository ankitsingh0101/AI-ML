"""
config.py — Central configuration for the object detection project.
All training, evaluation, and inference parameters are defined here.
Modify these values before running any pipeline step.
"""

import os
from pathlib import Path

# ─────────────────────────────────────────────
#  Project Paths
# ─────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR  = PROJECT_ROOT / "dataset"
MODELS_DIR   = PROJECT_ROOT / "models"
OUTPUTS_DIR  = PROJECT_ROOT / "outputs"
SRC_DIR      = PROJECT_ROOT / "src"

IMAGES_DIR   = DATASET_DIR / "images"
LABELS_DIR   = DATASET_DIR / "labels"
DATA_YAML    = DATASET_DIR / "data.yaml"

TRAIN_IMAGES = IMAGES_DIR / "train"
VAL_IMAGES   = IMAGES_DIR / "val"
TEST_IMAGES  = IMAGES_DIR / "test"
TRAIN_LABELS = LABELS_DIR / "train"
VAL_LABELS   = LABELS_DIR / "val"
TEST_LABELS  = LABELS_DIR / "test"

TRAINING_OUT   = OUTPUTS_DIR / "training"
EVALUATION_OUT = OUTPUTS_DIR / "evaluation"
DETECTIONS_OUT = OUTPUTS_DIR / "detections"

# ─────────────────────────────────────────────
#  Dataset mode
#  "coco128"   — 128-image COCO sample (fast, already downloaded)
#  "coco_full" — full COCO 2017 (auto-downloads ~26 GB on first train)
# ─────────────────────────────────────────────
DATASET_MODE = "coco128"

# Train / Val / Test split ratios for coco128 mode (must sum to 1.0)
SPLIT_RATIOS = {"train": 0.70, "val": 0.20, "test": 0.10}

# Minimum bounding box area (fraction of image area)
MIN_BOX_AREA_FRACTION = 0.001

# Random seed for reproducible splits
RANDOM_SEED = 42

# ─────────────────────────────────────────────
#  COCO 80 Classes (official COCO order)
# ─────────────────────────────────────────────
CLASSES = [
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

CLASS_TO_IDX = {cls: idx for idx, cls in enumerate(CLASSES)}
IDX_TO_CLASS = {idx: cls for cls, idx in CLASS_TO_IDX.items()}
NUM_CLASSES  = len(CLASSES)   # 80

# ─────────────────────────────────────────────
#  Model Configuration
# ─────────────────────────────────────────────
# Base pretrained model (YOLOv8 nano — fastest, good for laptop)
# Alternatives: "yolov8s.pt" (small), "yolov8m.pt" (medium)
PRETRAINED_WEIGHTS = "yolov8n.pt"

BEST_MODEL_PATH = MODELS_DIR / "best.pt"
LAST_MODEL_PATH = MODELS_DIR / "last.pt"

# ─────────────────────────────────────────────
#  Training Hyperparameters  (all configurable)
# ─────────────────────────────────────────────
TRAIN_EPOCHS       = 50
TRAIN_IMG_SIZE     = 640
TRAIN_BATCH_SIZE   = 16       # Reduce to 8 if running out of memory
TRAIN_LR0          = 0.01
TRAIN_LRF          = 0.01
TRAIN_MOMENTUM     = 0.937
TRAIN_WEIGHT_DECAY = 0.0005
TRAIN_WARMUP_EPOCHS = 3
TRAIN_PATIENCE     = 15       # Early stopping patience (0 = disabled)
TRAIN_WORKERS      = 0        # 0 is safest on Windows
TRAIN_DEVICE       = ""       # "" = auto-detect GPU; "cpu" = force CPU; "0" = GPU 0
TRAIN_PROJECT      = str(TRAINING_OUT)
TRAIN_NAME         = "yolov8n_coco80"
TRAIN_EXIST_OK     = True
TRAIN_PRETRAINED   = True
TRAIN_OPTIMIZER    = "SGD"
TRAIN_CACHE        = False
TRAIN_AMP          = True

# ─────────────────────────────────────────────
#  Inference / Detection Parameters
# ─────────────────────────────────────────────
CONF_THRESHOLD  = 0.35
IOU_THRESHOLD   = 0.45
MAX_DETECTIONS  = 100

# ─────────────────────────────────────────────
#  Webcam Configuration
# ─────────────────────────────────────────────
WEBCAM_INDEX  = 0
WEBCAM_WIDTH  = 1280
WEBCAM_HEIGHT = 720
WEBCAM_FPS_CAP = 30

BOX_THICKNESS  = 2
FONT_SCALE     = 0.6
FONT_THICKNESS = 2
OVERLAY_ALPHA  = 0.35

# ─────────────────────────────────────────────
#  Evaluation Configuration
# ─────────────────────────────────────────────
EVAL_IMG_SIZE   = 640
EVAL_BATCH_SIZE = 16
EVAL_CONF       = 0.001
EVAL_IOU        = 0.5
EVAL_SAVE_JSON  = True
EVAL_PLOTS      = True

POOR_PERF_MAP50_THRESHOLD = 0.30

# ─────────────────────────────────────────────
#  Kaggle credentials (used by download script)
# ─────────────────────────────────────────────
KAGGLE_USERNAME = "ankit121singh"
KAGGLE_KEY      = "KGAT_168db1d0002ff04ca80f7d0731680a39"
