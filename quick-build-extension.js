// Quick build script for complete extension including dashboard
import esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { execSync } from 'child_process';

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
  console.log('Building complete extension...\n');
  
  try {
    // Ensure dist directory exists
    const distDir = resolve(__dirname, 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    // Copy popup files (vanilla JS - no build needed)
    console.log('Copying popup files...');
    copyFile(
      resolve(__dirname, 'src/extension/popup/popup.html'),
      resolve(__dirname, 'dist/popup.html')
    );
    copyFile(
      resolve(__dirname, 'src/extension/popup/popup.js'),
      resolve(__dirname, 'dist/popup.js')
    );
    console.log('✓ popup files copied\n');
    
    // Build dashboard using Vite
    console.log('Building dashboard with Vite...');
    execSync('npm run build:dashboard', { stdio: 'inherit' });
    console.log('✓ dashboard built\n');
    
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
    
    // Copy manifest and static files
    console.log('Copying manifest and static files...');
    copyFile(
      resolve(__dirname, 'src/extension/manifest.json'),
      resolve(__dirname, 'dist/manifest.json')
    );
    
    // Copy public assets (icons, etc.)
    const publicDir = resolve(__dirname, 'public');
    const distPublicDir = resolve(__dirname, 'dist/public');
    if (existsSync(publicDir)) {
      console.log('Copying public assets...');
      if (!existsSync(distPublicDir)) {
        mkdirSync(distPublicDir, { recursive: true });
      }
      cpSync(publicDir, distPublicDir, { recursive: true });
      console.log('✓ Public assets copied\n');
    }
    
    console.log('\n✅ Complete extension built successfully!');
    console.log('\nIncludes:');
    console.log('  - Extension background worker');
    console.log('  - Content scripts');
    console.log('  - Popup UI');
    console.log('  - Dashboard');
    console.log('  - Manifest and icons');
    console.log('\nYou can now load the extension from the dist/ directory.');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildExtension();
