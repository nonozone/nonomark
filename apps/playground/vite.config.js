import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@nonoim/editor-vue/style.css', replacement: fileURLToPath(new URL('../../packages/vue/src/style.css', import.meta.url)) },
      { find: /^@nonoim\/editor-vue$/, replacement: fileURLToPath(new URL('../../packages/vue/src/index.js', import.meta.url)) },
      { find: /^@nonoim\/editor-core$/, replacement: fileURLToPath(new URL('../../packages/core/src/index.js', import.meta.url)) },
    ],
  },
  build: {
    outDir: '../../playground-dist',
    emptyOutDir: true,
  },
});
