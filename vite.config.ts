import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/tesseract.js')) {
            return 'pdf-engine';
          }
          if (id.includes('node_modules/docx') || id.includes('node_modules/mammoth') || id.includes('node_modules/docx-preview')) {
            return 'doc-engine';
          }
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/papaparse') || id.includes('node_modules/js-yaml') || id.includes('node_modules/xml-js')) {
            return 'data-engine';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/motion') || id.includes('node_modules/lucide-react')) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
