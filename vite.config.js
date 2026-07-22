import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'jsdom' },
  build: {
    lib: { entry: 'src/index.js', name: 'NonoEditor', formats: ['es', 'cjs'], fileName: (format) => format === 'es' ? 'editor.js' : 'editor.cjs', cssFileName: 'editor' },
    rollupOptions: { external: (id) => id === 'vue' || id.startsWith('@tiptap/'), output: { exports: 'named' } }
  }
});
