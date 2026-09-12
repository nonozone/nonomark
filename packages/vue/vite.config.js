import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: { 'editor-vue': 'src/index.js', lazy: 'src/lazy.js' },
      name: 'NonoEditorVue',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'editor-vue',
    },
    rollupOptions: {
      external: (id) => id === 'vue' || id === '@nonoim/editor-core' || id.startsWith('@tiptap/'),
      output: { exports: 'named' },
    },
  },
});
