import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

// Separate config for building dashboard page
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      include: "**/*.{jsx,tsx}",
    }),
    // Plugin to move dashboard.html to root of dist
    {
      name: 'move-dashboard-html',
      closeBundle() {
        const src = resolve(__dirname, '../dist/src/dashboard/dashboard.html');
        const dest = resolve(__dirname, '../dist/dashboard.html');
        try {
          copyFileSync(src, dest);
          console.log('✓ Moved dashboard.html to dist root');
        } catch (e) {
          console.error('Failed to move dashboard.html:', e);
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  build: {
    target: 'es2020',
    
    rollupOptions: {
      input: resolve(__dirname, '../src/dashboard/dashboard.html'),
      output: {
        entryFileNames: 'dashboard.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'dashboard.css') {
            return 'dashboard.css';
          }
          if (assetInfo.name === 'dashboard.html') {
            return 'dashboard.html';
          }
          return 'assets/[name].[ext]';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
      
      external: ['chrome'],
    },
    
    outDir: resolve(__dirname, '../dist'),
    sourcemap: false,
    minify: 'terser',
    
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging in dashboard
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
