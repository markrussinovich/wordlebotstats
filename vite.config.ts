import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isExtensionBuild = mode === 'extension';
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react({
        // Optimize React in production  
        jsxRuntime: 'automatic',
        // Enable React DevTools in development
        include: "**/*.{jsx,tsx}",
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      // Target modern browsers for better performance
      target: 'es2020',
      
      // Enable tree shaking
      rollupOptions: isExtensionBuild ? {
        input: resolve(__dirname, 'src/extension/background/background.ts'),
        output: {
          entryFileNames: 'background.js',
          dir: 'dist',
          format: 'iife',
          name: 'background',
        },
        external: ['chrome'],
      } : {
        // Web build optimizations
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'charts-vendor': ['recharts'],
            'utilities': ['zustand', 'immer'],
          },
        },
      },
      
      outDir: 'dist',
      sourcemap: isDevelopment,
      minify: isProduction ? 'terser' : false,
      
      // Terser options for production optimization
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug'],
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      } : undefined,
      
      // Chunk size warnings
      chunkSizeWarningLimit: 1000, // 1MB limit for extension
      
      // CSS code splitting
      cssCodeSplit: true,
      
      // Asset inlining threshold (for small images/fonts) 
      assetsInlineLimit: 4096, // 4KB
      
      // Copy public assets including icons
      copyPublicDir: true
    },
    
    // Optimization options
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'zustand',
        'immer',
      ],
      exclude: [
        // Exclude large libraries from pre-bundling in dev
        'recharts',
      ],
    },
    
    define: {
      __DEV__: isDevelopment,
      // Remove process.env checks in production
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    
    // Performance settings
    esbuild: {
      // Tree shaking for better performance
      treeShaking: true,
      // Remove unused code
      pure: ['console.log'],
      // Target modern JS for better optimization
      target: 'es2020',
    },
    
    // Server optimizations for development
    server: {
      // Enable HMR for faster development
      hmr: true,
      // Preload popular chunks
      warmup: {
        clientFiles: [
          './src/components/**/*.tsx',
          './src/dashboard/**/*.tsx',
          './src/stores/**/*.ts',
        ],
      },
    },
  };
});