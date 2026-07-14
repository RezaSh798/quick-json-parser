import { defineConfig } from 'vite';
import { resolve } from 'path';

const targetBrowser = process.env.TARGET_BROWSER || 'chrome';
const isFirefox = targetBrowser === 'firefox';

/*
 * Firefox (MV3) does not support ES modules in `background.scripts` and
 * frequently fails to load `type="module" crossorigin` resources inside
 * extension pages. For Firefox we emit a classic IIFE bundle for the viewer
 * and strip the module/crossorigin attributes from the generated HTML.
 * The background script is compiled separately (see scripts/build.js) into
 * its own classic IIFE so it can run as a Firefox background script.
 */
export default defineConfig({
  build: {
    outDir: resolve(__dirname, `dist/${targetBrowser}`),
    emptyOutDir: true,
    ...(isFirefox ? { modulePreload: false } : {}),
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, 'viewer.html'),
        ...(isFirefox ? {} : { background: resolve(__dirname, 'src/background.ts') })
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'styles.[ext]',
        ...(isFirefox ? { format: 'iife' } : {})
      }
    }
  },
  plugins: isFirefox
    ? [
        {
          name: 'firefox-classic-scripts',
          transformIndexHtml(html) {
            return html
              .replace(/ type="module"/g, '')
              .replace(/ crossorigin/g, '');
          }
        }
      ]
    : []
});
