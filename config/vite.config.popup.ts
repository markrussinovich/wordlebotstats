import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Separate config for building popup as a single self-contained bundle
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      include: "**/*.{jsx,tsx}",
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  build: {
    target: 'es2020',
    
    rollupOptions: {
      input: {
        popup: resolve(__dirname, '../src/extension/popup/popup.tsx'),
      },
      output: {
        entryFileNames: 'popup.js',
        format: 'iife',
        // Bundle everything into one file
        inlineDynamicImports: true,
        dir: '../dist',
      },
      
      external: ['chrome'],
    },
    
    outDir: '../dist',
    sourcemap: false,
    minify: 'terser',
    
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
    },
    
    // Don't clear outDir since we're building into existing dist
    emptyOutDir: false,
  },
  
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
