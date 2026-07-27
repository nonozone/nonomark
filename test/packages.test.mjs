import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readPackage = (name) => JSON.parse(readFileSync(new URL(`../packages/${name}/package.json`, import.meta.url), 'utf8'));

test('framework packages have explicit dependency boundaries', () => {
  const core = readPackage('core');
  const vue = readPackage('vue');
  const react = readPackage('react');
  const compat = readPackage('editor');

  assert.equal(core.name, '@nonoim/editor-core');
  assert.equal(core.dependencies, undefined);
  assert.equal(core.peerDependencies, undefined);

  assert.equal(vue.name, '@nonoim/editor-vue');
  assert.equal(vue.version, core.version);
  assert.equal(vue.peerDependencies.vue, '^3.5.0');
  assert.equal(vue.dependencies['@nonoim/editor-core'], core.version);
  assert.equal(vue.dependencies['@nonoim/editor'], undefined);
  assert.equal(vue.dependencies.react, undefined);

  assert.equal(react.name, '@nonoim/editor-react');
  assert.equal(react.version, core.version);
  assert.equal(react.peerDependencies.react, '^18.2.0 || ^19.0.0');
  assert.equal(react.peerDependencies['react-dom'], '^18.2.0 || ^19.0.0');
  assert.equal(react.dependencies['@nonoim/editor-core'], core.version);
  assert.equal(react.dependencies.vue, undefined);

  assert.equal(compat.name, '@nonoim/editor');
  assert.equal(compat.version, core.version);
  assert.equal(compat.dependencies['@nonoim/editor-vue'], vue.version);
  assert.equal(compat.dependencies['@nonoim/editor-core'], core.version);

  for (const pkg of [core, vue, react, compat]) {
    assert.equal(pkg.scripts.prepack, 'npm run build');
  }
});

test('core entry is framework independent and exposes both upload providers', async () => {
  const source = readFileSync(new URL('../packages/core/src/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"](?:vue|react)/);

  const core = await import('../packages/core/src/index.js');
  const backup = await import('../packages/core/src/editorBackup.js');
  const s3 = await import('../packages/core/src/uploadS3.js');
  assert.equal(typeof core.createEditorBackup, 'function');
  assert.equal(typeof backup.createEditorBackup, 'function');
  assert.equal(typeof core.createLocalImageUploader, 'function');
  assert.equal(typeof core.requiresSourceMode, 'function');
  assert.equal(typeof s3.createS3ImageUploader, 'function');
});
