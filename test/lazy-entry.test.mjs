import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const packageJson = (name) => JSON.parse(read(`../packages/${name}/package.json`));

test('Vue lazy entry keeps the full editor behind a dynamic import', () => {
  const source = read('../packages/vue/src/lazy.js');
  assert.match(source, /import\(['"]\.\/NonoEditor\.vue['"]\)/);
  assert.doesNotMatch(source, /^import\s+.+from\s+['"]\.\/NonoEditor\.vue['"]/m);
  assert.equal(packageJson('vue').exports['./lazy'].import, './dist/lazy.js');
  assert.equal(packageJson('vue').exports['./lazy'].types, './src/lazy.d.ts');
});

test('React lazy entry keeps the full editor behind a dynamic import', () => {
  const source = read('../packages/react/src/lazy.jsx');
  assert.match(source, /import\(['"]\.\/NonoEditor\.jsx['"]\)/);
  assert.doesNotMatch(source, /^import\s+.+from\s+['"]\.\/NonoEditor\.jsx['"]/m);
  assert.equal(packageJson('react').exports['./lazy'].import, './dist/lazy.js');
  assert.equal(packageJson('react').exports['./lazy'].types, './src/lazy.d.ts');
});

test('compatibility package forwards the Vue lazy entry', () => {
  const source = read('../packages/editor/src/lazy.js');
  assert.match(source, /@nonoim\/editor-vue\/lazy/);
  assert.equal(packageJson('editor').exports['./lazy'].import, './dist/lazy.js');
});
