# AI-Based Real-Time Detection of 112 Daily-Life Objects

A complete AI/ML object detection system that identifies **112 real-world everyday object categories** in real time through a webcam.
Built with **YOLOv8** (Ultralytics) fine-tuned on **Open Images V7** (Google).

---

## What It Detects

112 daily-life categories across 12 domains:

| Domain | Example Classes |
|---|---|
| People | Person |
| Vehicles | Car, Bicycle, Motorcycle, Bus, Truck, Airplane, Train, Boat |
| Electronics | Laptop, Mobile phone, TV, Camera, Headphones, Keyboard, Mouse |
| Kitchenware | Bottle, Cup, Mug, Plate, Bowl, Fork, Spoon, Knife, Wine glass |
| Furniture | Chair, Table, Couch, Bed, Door, Window, Mirror, Shelf |
| Clothing / Accessories | Backpack, Handbag, Shoe, Hat, Watch, Glasses, Umbrella |
| Stationery / Office | Book, Pen, Scissors, Ruler, Stapler, Clock |
| Food | Apple, Banana, Pizza, Hamburger, Sandwich, Cake, Bread |
| Animals | Dog, Cat, Bird, Fish |
| Sports | Ball, Tennis racket, Skateboard, Bicycle helmet |
| Personal Care | Toothbrush, Hair dryer, Soap dispenser, Comb |
| Street / Outdoor | Traffic light, Stop sign, Fire hydrant, Bench, Trash can |

---

## Project Structure

```
object-detection-100-plus/
│
├── dataset/
│   ├── images/
│   │   ├── train/          ← ~41,250 images after default download
│   │   ├── val/            ← ~8,250 images
│   │   └── test/           ← ~5,500 images
│   ├── labels/
│   │   ├── train/          ← YOLO-format .txt annotation files
│   │   ├── val/
│   │   └── test/
│   └── data.yaml           ← Ultralytics dataset config (112 classes)
│
├── models/
│   ├── best.pt             ← Best fine-tuned YOLOv8n (saved after training)
│   └── last.pt             ← Last epoch checkpoint
│
├── src/
│   ├── config.py           ← All configurable parameters
│   ├── utils.py            ← Shared utilities (drawing, validation, FPS)
│   ├── prepare_dataset.py  ← Download Open Images V7 + convert to YOLO
│   ├── train.py            ← Fine-tune YOLOv8n on 112 classes
│   ├── evaluate.py         ← mAP, per-class metrics, confusion matrix
│   └── detect_webcam.py    ← Real-time webcam detection application
│
├── outputs/
│   ├── training/           ← Training results, plots, checkpoints
│   ├── evaluation/         ← Evaluation metrics CSV, summary text
│   └── detections/         ← Saved frames (pressed S during webcam)
│
├── requirements.txt
├── README.md
└── .gitignore
```

---

## Quick Start

### 1. Install dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux / macOS

# Install requirements
pip install -r requirements.txt
```

**GPU users** (strongly recommended for training):
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

### 2. Download and prepare the dataset

```bash
# Default: 500 images per class (~55,000 images total, ~20 GB)
python src/prepare_dataset.py

# Faster test run (200 per class, ~22,000 images, ~8 GB):
python src/prepare_dataset.py --max-per-class 200

# See all options:
python src/prepare_dataset.py --help
```

> **Note**: Open Images V7 is downloaded directly from Google Cloud Storage via the
> `fiftyone` library. First-time download may take **2–8 hours** depending on bandwidth.
> The download is resumable — if interrupted, re-run the same command.

### 3. Train the model

```bash
# Fine-tune YOLOv8n (recommended for laptops, ~4–8h on GPU, ~24–48h on CPU):
python src/train.py

# Custom parameters:
python src/train.py --epochs 30 --batch-size 8 --device cpu

# GPU training (fast):
python src/train.py --epochs 50 --batch-size 32 --device 0

# Resume interrupted training:
python src/train.py --resume

# See all options:
python src/train.py --help
```

Training outputs are saved to `outputs/training/yolov8n_openimages_112cls/`:
- `weights/best.pt` (also copied to `models/best.pt`)
- `weights/last.pt` (also copied to `models/last.pt`)
- `results.csv` — per-epoch loss and metrics
- `confusion_matrix.png`, `PR_curve.png`, `F1_curve.png`
- Mosaic visualisations of training / validation batches

### 4. Evaluate the model

```bash
# Evaluate on test set (default):
python src/evaluate.py

# Evaluate on validation set:
python src/evaluate.py --split val

# Use a custom model:
python src/evaluate.py --model models/best.pt --split test

# See all options:
python src/evaluate.py --help
```

Outputs saved to `outputs/evaluation/`:
- `metrics_summary_test.txt` — Overall P, R, mAP@50, mAP@50-95
- `per_class_metrics_test.csv` — Per-class AP50, AP50-95, P, R
- `poor_performing_classes_test.txt` — Classes with AP@50 < 0.30

### 5. Real-time webcam detection

```bash
# Run with the trained model:
python src/detect_webcam.py

# Custom confidence threshold:
python src/detect_webcam.py --conf 0.45

# Specific webcam (if you have multiple cameras):
python src/detect_webcam.py --webcam 1

# See all options:
python src/detect_webcam.py --help
```

**Keyboard controls during detection:**

| Key | Action |
|---|---|
| `Q` or `ESC` | Quit |
| `S` | Save current annotated frame to `outputs/detections/` |
| `+` | Increase confidence threshold by 0.05 |
| `-` | Decrease confidence threshold by 0.05 |
| `F` | Toggle fullscreen |
| `H` | Toggle help overlay |

---

## Configuration

All parameters are in [`src/config.py`](src/config.py). Key settings:

```python
# Dataset
MAX_IMAGES_PER_CLASS = 500   # Images per class (reduce for faster testing)

# Training
TRAIN_EPOCHS      = 50
TRAIN_IMG_SIZE    = 640
TRAIN_BATCH_SIZE  = 16       # Reduce to 8 if running out of memory
TRAIN_LR0         = 0.01
TRAIN_DEVICE      = ""       # "" = auto, "cpu", "0" = first GPU

# Inference
CONF_THRESHOLD    = 0.35
IOU_THRESHOLD     = 0.45

# Webcam
WEBCAM_INDEX      = 0        # Default camera
```

---

## Dataset: Open Images V7 (Google)

| Property | Value |
|---|---|
| Source | [Open Images Dataset V7](https://storage.googleapis.com/openimages/web/index.html) |
| License | [Creative Commons CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Total images (full) | ~9 million |
| Detection-annotated | ~1.9 million |
| Classes available | 600 |
| Classes used | 112 |
| Download method | `fiftyone` library (selective class download) |
| Annotation format | Normalised bounding boxes → converted to YOLO format |

**Estimated dataset size** with default settings (500 images/class):
- Images: ~55,000
- Disk: ~20–25 GB
- Training time: ~4–8 h (GPU) / ~24–48 h (CPU)

---

## Model

| Property | Value |
|---|---|
| Architecture | YOLOv8n (nano) |
| Parameters | 3.2 million |
| Input size | 640 × 640 |
| Base weights | Pretrained on COCO 80-class dataset |
| Fine-tuning | Transfer learning on 112-class Open Images subset |
| Expected mAP@50 | ~45–60% (after 50 epochs, GPU) |
| Expected FPS (laptop CPU) | ~8–15 fps |
| Expected FPS (GPU) | ~30–60 fps |

To use a larger model for better accuracy (at the cost of speed), change in `config.py`:
```python
PRETRAINED_WEIGHTS = "yolov8s.pt"   # small  (11 M params, ~+7% mAP)
PRETRAINED_WEIGHTS = "yolov8m.pt"   # medium (26 M params, ~+13% mAP)
```

---

## Webcam Output Example

```
┌──────────────────────────────────────────────┐
│  FPS: 24.3                    Conf: 0.35      │
│  Objects: 5                                   │
│                                               │
│  ┌──────────┐   Person  96%                   │
│  │          │                                 │
│  └──────────┘   Laptop  91%                   │
│       ┌───┐     Bottle  87%                   │
│       └───┘     Mobile phone  84%             │
│                 Chair  94%                    │
└──────────────────────────────────────────────┘
```

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Python | 3.9 | 3.11 |
| RAM | 8 GB | 16 GB |
| Disk (dataset) | 10 GB | 30 GB |
| CPU | Any modern quad-core | Intel i7 / AMD Ryzen 7 |
| GPU | None (CPU fallback) | NVIDIA GTX 1060+ / RTX 2060+ |
| CUDA | — | 11.8 or 12.1 |
| Webcam | Any USB/built-in | 1080p USB webcam |

---

## Pipeline Overview

```
Open Images V7 (Google Cloud)
         │
         │  fiftyone (selective 112-class download)
         ▼
  Raw images + OI annotations
         │
         │  prepare_dataset.py
         │  ├── Convert bounding boxes → YOLO format
         │  ├── Validate & sanitise
         │  └── Split train/val/test (75/15/10)
         ▼
  dataset/images/  +  dataset/labels/  +  data.yaml
         │
         │  train.py
         │  └── YOLOv8n fine-tuning (transfer learning)
         ▼
  models/best.pt  +  training plots
         │
         │  evaluate.py
         │  └── mAP, per-class AP50, confusion matrix
         ▼
  outputs/evaluation/
         │
         │  detect_webcam.py
         │  └── Real-time webcam inference
         ▼
  Live bounding-box overlay at 8–60 FPS
```

---

## Troubleshooting

**`fiftyone` download fails / slow**
- Ensure stable internet connection (Google Cloud Storage).
- fiftyone download is resumable — re-run the same command.
- Reduce `--max-per-class 100` for a quick smoke test.

**Out of Memory during training**
- Reduce batch size: `python src/train.py --batch-size 8`
- Reduce image size: `python src/train.py --img-size 416`
- Set `TRAIN_CACHE = False` in `config.py`

**Windows DataLoader workers error**
- Set `TRAIN_WORKERS = 0` in `config.py`

**Webcam not detected**
- Ensure no other application is using the camera.
- Try `--webcam 1` if index 0 fails.
- On Windows, the app uses `cv2.CAP_DSHOW` backend automatically.

**Low FPS on CPU**
- Reduce inference image size: `python src/detect_webcam.py --img-size 416`
- Increase confidence threshold to reduce drawing work: `--conf 0.5`

---

## License

- **Code**: MIT License
- **Dataset**: Open Images V7 — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Pretrained YOLOv8 weights**: [AGPL-3.0](https://github.com/ultralytics/ultralytics/blob/main/LICENSE) (Ultralytics)
