import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: 'playground',
  base: './',
  plugins: [vue()],
  build: {
    outDir: '../playground-dist',
    emptyOutDir: true,
  },
});
