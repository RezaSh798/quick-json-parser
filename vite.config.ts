import { defineConfig } from 'vite';
import { resolve } from 'path';

const targetBrowser = process.env.TARGET_BROWSER || 'chrome';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, `dist/${targetBrowser}`),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, 'viewer.html'),
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'styles.[ext]'
      }
    }
  }
});