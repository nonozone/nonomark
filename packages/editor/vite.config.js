import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: { editor: 'src/index.js', lazy: 'src/lazy.js', 'upload-s3': 'src/uploadS3.js' },
      name: 'NonoEditorCompat',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'editor',
    },
    rollupOptions: {
      external: (id) => id.startsWith('@nonoim/'),
      output: { exports: 'named' },
    },
  },
});
