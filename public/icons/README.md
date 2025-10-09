# Extension Icons

This directory contains the icon assets for the Wordle Stats Explorer browser extension.

## Icon Files

- **SVG Files** (`icon-*.svg`): Source vector graphics files
  - `icon-16.svg` - 16×16 pixels
  - `icon-32.svg` - 32×32 pixels
  - `icon-48.svg` - 48×48 pixels
  - `icon-128.svg` - 128×128 pixels

- **PNG Files** (`icon-*.png`): Automatically generated from SVG files
  - These are created during the build process
  - Do not edit these manually - edit the SVG files instead

## Icon Design

Each icon features:
- 3×3 Wordle tile grid showing a game progression
  - Top row: Empty tiles (unfilled)
  - Middle row: Grey, Yellow, Grey (partial match)
  - Bottom row: All Green (correct word)
- Blue circular badge in the bottom-right corner with white bar chart icon
  - Indicates this is a statistics/analytics tool, not just Wordle

## Automatic Conversion

The SVG icons are automatically converted to PNG during the build process using the `sharp` library for high-quality rendering.

### When Icons Are Converted

PNG files are automatically generated during:
```bash
npm run build:quick    # Full extension build (includes icon conversion)
```

### Manual Conversion

To convert icons manually without building the entire extension:
```bash
npm run build:icons    # Convert SVG to PNG only
```

Or run the conversion script directly:
```bash
node scripts/convert-icons.js
```

## Editing Icons

1. Edit the SVG files (`icon-*.svg`) using a vector graphics editor or text editor
2. Run `npm run build:icons` to regenerate the PNG files
3. Test the icons by loading the extension in Chrome/Edge

## Technical Details

- **Conversion Tool**: Sharp (Node.js image processing library)
- **Conversion Script**: `scripts/convert-icons.js`
- **Quality**: PNG files are generated at 100% quality with maximum compression
- **Sizes**: Each PNG matches its corresponding SVG dimensions exactly

## Fallback Methods

If the `sharp` package fails, the script will attempt to use the `canvas` package as a fallback. If both fail, you can manually convert using:

- **ImageMagick**:
  ```bash
  magick convert icon-16.svg -density 96 icon-16.png
  magick convert icon-32.svg -density 96 icon-32.png
  magick convert icon-48.svg -density 96 icon-48.png
  magick convert icon-128.svg -density 96 icon-128.png
  ```

- **Online Converters**:
  - https://convertio.co/svg-png/
  - https://cloudconvert.com/svg-to-png
  - https://svgtopng.com/

## Troubleshooting

If icon conversion fails:
1. Ensure `sharp` is installed: `npm install --save-dev sharp`
2. Check for SVG syntax errors (must be valid XML)
3. Try the fallback manual conversion methods above
