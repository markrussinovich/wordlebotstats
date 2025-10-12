# Screenshot Resizer for Chrome Web Store

This script automatically resizes screenshots to meet Chrome Web Store requirements (1280×800 or 640×400) with proper padding/letterboxing.

## Requirements

Install Pillow (Python Imaging Library):

```bash
pip install Pillow
```

## Usage

### Basic usage (resize to 1280×800):
```bash
cd scripts
python resize-screenshots.py
```

### Resize to 640×400:
```bash
python resize-screenshots.py --size small
```

### Specify custom directories:
```bash
python resize-screenshots.py --input-dir ../listing/assets --output-dir ../listing/assets/resized
```

### Force specific background color:
```bash
python resize-screenshots.py --background white   # White padding
python resize-screenshots.py --background dark    # Dark grey padding
python resize-screenshots.py --background auto    # Auto-detect (default)
```

## Features

- **Maintains aspect ratio**: Never stretches or distorts images
- **Smart padding**: Adds background color to fill required dimensions
- **Auto background detection**: Chooses appropriate padding color based on image content
- **Multiple formats**: Supports PNG, JPG, GIF, BMP, TIFF
- **Quality optimization**: Saves with high quality and optimization
- **Batch processing**: Handles multiple images at once

## Output

- Creates `listing/assets/resized/` directory
- Saves files with `_resized` suffix
- Maintains original file format
- Provides detailed processing information

## Chrome Web Store Specs

- **Large**: 1280×800 pixels (recommended)
- **Small**: 640×400 pixels (acceptable)
- **Format**: PNG preferred
- **Requirements**: Square corners, full bleed, no borders

After running, review the resized images and replace the originals in `listing/assets/` if they look correct.