import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIRS = [
  path.resolve('public', 'icons'),
  path.resolve('dist', 'icons')
];

const SIZES = [16, 32, 48, 128] as const;

const COLORS = {
  border: '#111111',
  background: '#f8f8f8',
  absent: '#787c7e',
  present: '#c9b458',
  correct: '#6aaa64'
} as const;

type CellColor = keyof typeof COLORS;

const GRID: CellColor[][] = [
  ['background', 'background', 'background'],
  ['absent', 'present', 'absent'],
  ['correct', 'correct', 'correct']
];

const hexToRgba = (hex: string) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  if (normalized.length === 6) {
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b, a: 255 };
  }
  throw new Error(`Unsupported hex color: ${hex}`);
};

const fillRect = (png: PNG, x: number, y: number, width: number, height: number, color: { r: number; g: number; b: number; a: number }) => {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(png.width, Math.ceil(x + width));
  const endY = Math.min(png.height, Math.ceil(y + height));

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const idx = (png.width * py + px) << 2;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }
};

const ensureDirs = () => {
  OUTPUT_DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const createIcon = (size: number) => {
  const png = new PNG({ width: size, height: size });
  const scale = size / 120;

  const borderColor = hexToRgba(COLORS.border);
  const boardBackground = hexToRgba(COLORS.background);

  // Fill with border color first
  fillRect(png, 0, 0, size, size, borderColor);

  const boardMargin = 6 * scale;
  fillRect(png, boardMargin, boardMargin, size - boardMargin * 2, size - boardMargin * 2, boardBackground);

  const cellSize = 24 * scale;
  const stroke = Math.max(1, Math.round(4 * scale / 2));

  const positions = [20, 52, 84];

  positions.forEach((posY, rowIndex) => {
    positions.forEach((posX, colIndex) => {
      const cellColorKey = GRID[rowIndex][colIndex];
      const cellColor = hexToRgba(COLORS[cellColorKey]);

      const x = posX * scale;
      const y = posY * scale;

      // Outer stroke
      fillRect(png, x, y, cellSize, cellSize, borderColor);

      // Inner tile
      fillRect(
        png,
        x + stroke,
        y + stroke,
        cellSize - stroke * 2,
        cellSize - stroke * 2,
        cellColor
      );
    });
  });

  return png;
};

const writeIcons = () => {
  ensureDirs();

  SIZES.forEach((size) => {
  const png = createIcon(size);
  const buffer = PNG.sync.write(png);
    OUTPUT_DIRS.forEach((dir) => {
      const filePath = path.join(dir, `icon-${size}.png`);
      fs.writeFileSync(filePath, buffer);
    });
  });
};

writeIcons();
console.log('Generated Wordle grid icons at sizes:', SIZES.join(', '));
