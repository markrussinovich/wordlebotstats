// Quick build script for extension files only (bypasses strict type checking)
import esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sharedConfig = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  external: ['chrome'],
  // Allow errors for quicker testing builds
  logLevel: 'info',
  minify: false,
  sourcemap: false,
};

function copyFile(src, dest) {
  try {
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`✓ Copied ${src.split('\\').pop() || src.split('/').pop()}`);
    } else {
      console.warn(`⚠ Source file not found: ${src}`);
    }
  } catch (error) {
    console.error(`❌ Failed to copy ${src}:`, error.message);
  }
}

async function buildExtension() {
  console.log('Building extension files...\n');
  
  try {
    // Build background script (service worker - no IIFE wrapper needed)
    console.log('Building background.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(__dirname, 'src/extension/background/background.ts')],
      outfile: resolve(__dirname, 'dist/background.js'),
      format: 'esm', // Use ES modules for service worker
    });
    console.log('✓ background.js built\n');
    
    // Build wordleBotContent script (content scripts need IIFE)
    console.log('Building wordleBotContent.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(__dirname, 'src/extension/content/wordleBotContent.ts')],
      outfile: resolve(__dirname, 'dist/wordleBotContent.js'),
      format: 'iife',
      globalName: 'WordleBotContent',
    });
    console.log('✓ wordleBotContent.js built\n');
    
    // Build wordleContent script (content scripts need IIFE)
    console.log('Building content.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(__dirname, 'src/extension/content/wordleContent.ts')],
      outfile: resolve(__dirname, 'dist/content.js'),
      format: 'iife',
      globalName: 'WordleContent',
    });
    console.log('✓ content.js built\n');
    
    // Copy manifest and popup files
    console.log('Copying manifest and popup files...');
    copyFile(
      resolve(__dirname, 'src/extension/manifest.json'),
      resolve(__dirname, 'dist/manifest.json')
    );
    copyFile(
      resolve(__dirname, 'src/extension/popup/popup.html'),
      resolve(__dirname, 'dist/popup.html')
    );
    
    // Check if popup.js exists, if not, note it needs to be built separately
    const popupJsPath = resolve(__dirname, 'dist/popup.js');
    if (!existsSync(popupJsPath)) {
      console.log('\n⚠ Note: popup.js not found. Run "npm run build:popup" if needed.\n');
    }
    
    console.log('\n✅ All extension files built successfully!');
    console.log('\nYou can now test the extension from the dist/ directory.');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildExtension();
