import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'NonoEditorVue',
      formats: ['es', 'cjs'],
      fileName: (format) => `editor-vue.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'editor-vue',
    },
    rollupOptions: {
      external: (id) => id === 'vue' || id === '@nonoim/editor-core' || id.startsWith('@tiptap/'),
      output: { exports: 'named' },
    },
  },
});
