import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import {
  containsRawHtml,
  findUnsupportedMarkdown,
  requiresSourceMode,
} from '../packages/core/src/markdownCompatibility.js';
import { buildGalleryMarkdown } from '../packages/vue/src/gallery.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const makeEditor = (content) => new Editor({
  extensions: [StarterKit, Image, TableKit, Markdown],
  content,
  contentType: 'markdown',
});

test('public package contract is storage independent', () => {
  const root = JSON.parse(read('../package.json'));
  const pkg = JSON.parse(read('../packages/editor/package.json'));
  const source = read('../packages/vue/src/NonoEditor.vue');
  assert.equal(root.name, 'nonomark');
  assert.equal(root.private, true);
  assert.equal(pkg.name, '@nonoim/editor');
  assert.equal(pkg.version, root.version);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.deepEqual(pkg.exports['./upload-s3'], {
    types: './src/uploadS3.d.ts',
    import: './dist/upload-s3.js',
    require: './dist/upload-s3.cjs',
  });
  assert.match(source, /uploadImages:\s*\{ type: Function/);
  assert.match(source, /emit\('warning'/);
  assert.match(source, /emit\('upload-error'/);
  assert.doesNotMatch(source, /PocketBase|media_assets|useAdminI18n|useToast|admin-color-/i);
});

test('supported Markdown structures round trip', () => {
  const samples = [
    '# Heading\n\n**bold** and [link](https://example.com)',
    '- parent\n  - child\n\n1. first\n2. second',
    '```js\nconst value = 1;\n```',
    '| A | B |\n| --- | --- |\n| 1 | 2 |',
    '![alt](https://example.com/image.png)',
  ];

  for (const sample of samples) {
    const first = makeEditor(sample);
    const second = makeEditor(first.getMarkdown());
    assert.deepEqual(second.getJSON(), first.getJSON(), sample);
    first.destroy();
    second.destroy();
  }
});

test('lossy Markdown features require source mode', () => {
  assert.deepEqual(findUnsupportedMarkdown('- [ ] todo'), ['task-list']);
  assert.deepEqual(findUnsupportedMarkdown('---\ntitle: Hello\n---\n\nBody'), ['frontmatter']);
  assert.deepEqual(findUnsupportedMarkdown('A note[^1].\n\n[^1]: Detail'), ['footnote']);
  assert.deepEqual(findUnsupportedMarkdown('<section>Keep</section>'), ['raw-html']);
  assert.equal(requiresSourceMode('**Markdown**'), false);
  assert.equal(requiresSourceMode('- [x] done'), true);
});

test('raw HTML remains detectable', () => {
  assert.equal(containsRawHtml('<section>Keep</section>'), true);
  assert.equal(containsRawHtml('**Markdown**'), false);
});

test('gallery output is plain Markdown image lines', () => {
  assert.equal(
    buildGalleryMarkdown([
      { url: 'https://example.com/one.jpg', caption: 'First image' },
      { url: 'https://example.com/two.jpg', alt: 'Two' },
      { url: 'https://example.com/three.jpg', caption: 'Third image' },
    ]),
    '![First image](https://example.com/one.jpg)\n![Two](https://example.com/two.jpg)\n![Third image](https://example.com/three.jpg)',
  );
  assert.throws(() => buildGalleryMarkdown([{ url: 'https://example.com/one.jpg' }]));
});

test('rich editor adapters explicitly keep TipTap input rules enabled', () => {
  const vue = read('../packages/vue/src/NonoEditor.vue');
  const react = read('../packages/react/src/NonoEditor.jsx');
  assert.match(vue, /new Editor\(\{ editable: editable\.value, enableInputRules: true,/);
  assert.match(react, /editable,\n\s+enableInputRules: true,/);
});
