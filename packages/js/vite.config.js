import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@nonoim/editor-core': fileURLToPath(new URL('../core/src/index.js', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'NonoEditorJS',
      formats: ['es', 'iife'],
      fileName: (format) => `editor-js.${format === 'es' ? 'js' : 'iife.js'}`,
    },
    rollupOptions: {
      output: { exports: 'named' },
    },
  },
});
