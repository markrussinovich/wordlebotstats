import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build content scripts separately as IIFE to avoid module issues
async function buildContentScripts() {
  console.log('Building content scripts...');
  
  // Build wordleContent.ts
  await build({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/extension/content/wordleContent.ts'),
        name: 'WordleContent',
        fileName: 'content',
        formats: ['iife']
      },
      outDir: 'dist',
      rollupOptions: {
        external: ['chrome'],
        output: {
          globals: {
            chrome: 'chrome'
          }
        }
      }
    }
  });
  
  // Build wordleBotContent.ts
  await build({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/extension/content/wordleBotContent.ts'),
        name: 'WordleBotContent',
        fileName: 'wordleBotContent',
        formats: ['iife']
      },
      outDir: 'dist',
      rollupOptions: {
        external: ['chrome'],
        output: {
          globals: {
            chrome: 'chrome'
          }
        }
      }
    }
  });
  
  // Build background.ts
  await build({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/extension/background/background.ts'),
        name: 'Background',
        fileName: 'background',
        formats: ['iife']
      },
      outDir: 'dist',
      rollupOptions: {
        external: ['chrome'],
        output: {
          globals: {
            chrome: 'chrome'
          }
        }
      }
    }
  });
  
  console.log('Content scripts built successfully!');
}

buildContentScripts().catch(console.error);