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
} from '../src/markdownCompatibility.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const makeEditor = (content) => new Editor({
  extensions: [StarterKit, Image, TableKit, Markdown],
  content,
  contentType: 'markdown',
});

test('public package contract is storage independent', () => {
  const pkg = JSON.parse(read('../package.json'));
  const source = read('../src/NonoEditor.vue');
  assert.equal(pkg.name, '@nonoim/editor');
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.publishConfig.access, 'public');
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
