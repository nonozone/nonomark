import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'jsdom' },
  build: {
    lib: {
      entry: { editor: 'src/index.js', 'upload-s3': 'src/uploadS3.js' },
      name: 'NonoEditor',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'editor',
    },
    rollupOptions: { external: (id) => id === 'vue' || id.startsWith('@tiptap/'), output: { exports: 'named' } }
  }
});
