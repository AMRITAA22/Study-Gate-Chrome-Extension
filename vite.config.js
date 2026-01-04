import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/popup.html'),
        options: path.resolve(__dirname, 'src/options/options.html'),
        background: path.resolve(__dirname, 'src/background/background.js'),
        contentScript: path.resolve(__dirname, 'src/content/contentScript.js'),
      },
      output: {
        entryFileNames: (chunk) => {
          // Force specific names for background and content scripts
          if (chunk.name === 'background') return 'src/background/background.js';
          if (chunk.name === 'contentScript') return 'src/content/contentScript.js';
          return 'src/[name]/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        // 👇 ADDED: Copy the HTML and CSS for the overlay
        { src: 'src/content/overlay.html', dest: 'src/content' },
        { src: 'src/content/overlay.css', dest: 'src/content' },
        { src: 'src/assets', dest: 'src' }
      ]
    })
  ]
});