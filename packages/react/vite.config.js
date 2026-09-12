import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: { 'editor-react': 'src/index.jsx', lazy: 'src/lazy.jsx' }, name: 'NonoEditorReact', formats: ['es', 'cjs'], fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`, cssFileName: 'editor-react' },
    rollupOptions: { external: (id) => id === 'react' || id === 'react-dom' || id === 'react/jsx-runtime' || id === '@nonoim/editor-core' || id.startsWith('@tiptap/'), output: { exports: 'named' } },
  },
});
