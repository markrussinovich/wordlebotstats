// Quick build script for complete extension including dashboard
import esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, cpSync, createWriteStream, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Plugin to resolve @ path aliases
const pathAliasPlugin = {
  name: 'path-alias',
  setup(build) {
    build.onResolve({ filter: /^@\// }, args => {
      const pathWithoutAlias = args.path.slice(2); // Remove '@/'
      const fullPath = resolve(rootDir, 'src', pathWithoutAlias);
      // Try with .ts extension if not already present
      const finalPath = fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') 
        ? fullPath 
        : `${fullPath}.ts`;
      return { path: finalPath };
    });
  }
};

const sharedConfig = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  external: ['chrome'],
  plugins: [pathAliasPlugin],
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
    const distDir = resolve(rootDir, 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    // Copy popup files (vanilla JS - no build needed)
    console.log('Copying popup files...');
    copyFile(
      resolve(rootDir, 'src/extension/popup/popup.html'),
      resolve(rootDir, 'dist/popup.html')
    );
    copyFile(
      resolve(rootDir, 'src/extension/popup/popup.js'),
      resolve(rootDir, 'dist/popup.js')
    );
    console.log('✓ popup files copied\n');
    
    // Build dashboard using Vite
    console.log('Building dashboard with Vite...');
    execSync('npm run build:dashboard', { stdio: 'inherit', cwd: rootDir });
    console.log('✓ dashboard built\n');
    
    // Build background script (service worker - no IIFE wrapper needed)
    console.log('Building background.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(rootDir, 'src/extension/background/background.ts')],
      outfile: resolve(rootDir, 'dist/background.js'),
      format: 'esm', // Use ES modules for service worker
    });
    console.log('✓ background.js built\n');
    
    // Build wordleBotContent script (content scripts need IIFE)
    console.log('Building wordleBotContent.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(rootDir, 'src/extension/content/wordleBotContent.ts')],
      outfile: resolve(rootDir, 'dist/wordleBotContent.js'),
      format: 'iife',
      globalName: 'WordleBotContent',
    });
    console.log('✓ wordleBotContent.js built\n');
    
    // Build wordleContent script (content scripts need IIFE)
    console.log('Building content.js...');
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [resolve(rootDir, 'src/extension/content/wordleContent.ts')],
      outfile: resolve(rootDir, 'dist/content.js'),
      format: 'iife',
      globalName: 'WordleContent',
    });
    console.log('✓ content.js built\n');
    
    // Copy manifest and static files
    console.log('Copying manifest and static files...');
    copyFile(
      resolve(rootDir, 'src/extension/manifest.json'),
      resolve(rootDir, 'dist/manifest.json')
    );
    
    // Copy public assets (icons, etc.)
    const publicDir = resolve(rootDir, 'public');
    const distPublicDir = resolve(rootDir, 'dist/public');
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
    await packageForStore(distDir);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function packageForStore(distDir) {
  console.log('\nPackaging extension for Chrome Web Store...');

  const listingDir = resolve(rootDir, 'listing');
  const latestBuildDir = resolve(listingDir, 'latest-build');

  if (!existsSync(listingDir)) {
    mkdirSync(listingDir, { recursive: true });
  }

  if (!existsSync(latestBuildDir)) {
    mkdirSync(latestBuildDir, { recursive: true });
  }

  let version = 'unversioned';
  const manifestPath = resolve(distDir, 'manifest.json');

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    version = manifest.version || version;
  } catch (error) {
    console.warn('⚠ Unable to read manifest version, defaulting to "unversioned".', error.message);
  }

  const zipName = `wordle-stat-explorer-${version}.zip`;
  const zipPath = resolve(latestBuildDir, zipName);

  if (existsSync(zipPath)) {
    unlinkSync(zipPath);
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✓ Packaged extension zip (${archive.pointer()} bytes) at ${zipPath}`);
      resolvePromise();
    });

    archive.on('error', (error) => {
      rejectPromise(error);
    });

    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });
}

buildExtension();
