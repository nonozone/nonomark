import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: { core: 'src/index.js', 'upload-s3': 'src/uploadS3.js' },
      name: 'NonoEditorCore',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: { output: { exports: 'named' } },
  },
});
