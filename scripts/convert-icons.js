// Convert SVG icons to PNG format for browser extension
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Using sharp for high-quality SVG to PNG conversion
async function convertIcons() {
  console.log('Converting SVG icons to PNG...');
  
  try {
    // Try to import sharp (needs to be installed)
    const sharp = await import('sharp').catch(() => null);
    
    if (!sharp) {
      console.log('⚠ sharp not available, attempting fallback method...');
      return convertWithCanvas();
    }
    
    const iconsDir = resolve(rootDir, 'public', 'icons');
    const sizes = [16, 32, 48, 128];
    
    for (const size of sizes) {
      const svgPath = resolve(iconsDir, `icon-${size}.svg`);
      const pngPath = resolve(iconsDir, `icon-${size}.png`);
      
      if (!existsSync(svgPath)) {
        console.warn(`⚠ ${svgPath} not found, skipping...`);
        continue;
      }
      
      try {
        await sharp.default(svgPath)
          .resize(size, size)
          .png({ quality: 100, compressionLevel: 9 })
          .toFile(pngPath);
        
        console.log(`✓ Created icon-${size}.png`);
      } catch (error) {
        console.error(`❌ Failed to convert icon-${size}.svg:`, error.message);
      }
    }
    
    console.log('✓ Icon conversion complete\n');
    return true;
  } catch (error) {
    console.error('❌ Icon conversion failed:', error.message);
    return false;
  }
}

// Fallback using canvas (requires canvas package)
async function convertWithCanvas() {
  try {
    const { createCanvas, Image } = await import('canvas');
    const iconsDir = resolve(rootDir, 'public', 'icons');
    const sizes = [16, 32, 48, 128];
    
    for (const size of sizes) {
      const svgPath = resolve(iconsDir, `icon-${size}.svg`);
      const pngPath = resolve(iconsDir, `icon-${size}.png`);
      
      if (!existsSync(svgPath)) {
        console.warn(`⚠ ${svgPath} not found, skipping...`);
        continue;
      }
      
      const svgContent = readFileSync(svgPath, 'utf8');
      
      // Create a data URL from SVG
      const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
      
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size, size);
          const buffer = canvas.toBuffer('image/png');
          writeFileSync(pngPath, buffer);
          console.log(`✓ Created icon-${size}.png`);
          resolve();
        };
        img.onerror = reject;
        img.src = svgDataUrl;
      });
    }
    
    console.log('✓ Icon conversion complete (using canvas)\n');
    return true;
  } catch (error) {
    console.error('❌ Canvas conversion also failed:', error.message);
    console.log('\n⚠ Install sharp or canvas package to enable automatic icon conversion:');
    console.log('  npm install --save-dev sharp');
    console.log('  or');
    console.log('  npm install --save-dev canvas');
    console.log('\nAlternatively, manually convert SVG files to PNG using online tools.');
    return false;
  }
}

// Run conversion if this script is executed directly
const isMainModule = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
                     import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  convertIcons().catch(err => {
    console.error('Failed to convert icons:', err);
    process.exit(1);
  });
}

export default convertIcons;
