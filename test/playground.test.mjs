import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MARKDOWN,
  SNAPSHOTS_KEY,
  STORAGE_KEY,
  clearDocument,
  getStorageHealth,
  loadDocument,
  loadSnapshots,
  saveDocument,
  saveSnapshot,
  shouldCreateSnapshot,
} from '../apps/playground/src/storage.js';
import { createLocalImageUploader } from '../packages/core/src/index.js';
import { createMarkdownExport, readMarkdownFile } from '../apps/playground/src/files.js';

const makeStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
};

test('playground starts as a distraction-free blank document', () => {
  const document = loadDocument(makeStorage());
  assert.equal(document.content, DEFAULT_MARKDOWN);
  assert.equal(document.content, '');
  assert.equal(document.updatedAt, null);
});

test('playground recovers saved content and ignores corrupt entries', () => {
  const storage = makeStorage();
  const saved = saveDocument(storage, '# Personal note', 1234);
  assert.deepEqual(loadDocument(storage), saved);

  storage.setItem(STORAGE_KEY, '{broken');
  assert.equal(loadDocument(storage).content, DEFAULT_MARKDOWN);
});

test('playground document can be cleared', () => {
  const storage = makeStorage();
  saveDocument(storage, 'temporary');
  clearDocument(storage);
  assert.equal(loadDocument(storage).content, DEFAULT_MARKDOWN);
});

test('playground keeps a deduplicated ring of recoverable snapshots', () => {
  const storage = makeStorage();
  saveSnapshot(storage, '# First', 100, { maxSnapshots: 2 });
  saveSnapshot(storage, '# First', 200, { maxSnapshots: 2 });
  saveSnapshot(storage, '# Second', 300, { maxSnapshots: 2 });
  saveSnapshot(storage, '# Third', 400, { maxSnapshots: 2 });

  assert.deepEqual(loadSnapshots(storage), [
    { content: '# Third', updatedAt: 400 },
    { content: '# Second', updatedAt: 300 },
  ]);

  storage.setItem(SNAPSHOTS_KEY, '{broken');
  assert.deepEqual(loadSnapshots(storage), []);
});

test('playground snapshots only after content changes and enough time passes', () => {
  const snapshots = [{ content: 'old', updatedAt: 1_000 }];
  assert.equal(shouldCreateSnapshot(snapshots, 'old', 99_000), false);
  assert.equal(shouldCreateSnapshot(snapshots, 'new', 10_000, 30_000), false);
  assert.equal(shouldCreateSnapshot(snapshots, 'new', 31_000, 30_000), true);
});

test('playground warns before the projected document exhausts local storage', () => {
  const storage = makeStorage();
  saveDocument(storage, 'small', 1);

  const healthy = getStorageHealth(storage, 'small', 4_096, 2);
  const crowded = getStorageHealth(storage, 'x'.repeat(1_700), 4_096, 2);

  assert.equal(healthy.level, 'ok');
  assert.equal(crowded.level, 'warning');
  assert.ok(crowded.projectedBytes > healthy.projectedBytes);
});

test('playground imports Markdown and creates a dated export', async () => {
  const file = new File(['# Imported'], 'notes.md', { type: 'text/markdown' });
  assert.equal(await readMarkdownFile(file), '# Imported');

  const exported = createMarkdownExport('# Exported', new Date('2026-07-23T08:09:00'));
  assert.equal(exported.filename, 'nonoMark-2026-07-23-0809.md');
  assert.equal(exported.blob.type, 'text/markdown;charset=utf-8');
  assert.equal(await exported.blob.text(), '# Exported');
});

test('playground rejects oversized or non-Markdown imports', async () => {
  await assert.rejects(
    readMarkdownFile(new File(['plain'], 'notes.txt', { type: 'text/plain' })),
    /Markdown/,
  );
  await assert.rejects(
    readMarkdownFile(new File(['12345'], 'large.md', { type: 'text/markdown' }), 4),
    /too large/i,
  );
});

test('playground embeds images as self-contained data URLs', async () => {
  const files = [{ name: 'first.png', type: 'image/png', size: 4 }, { name: 'second.webp', type: 'image/webp', size: 4 }];
  const progress = [];
  const uploadImages = createLocalImageUploader({
    readFile: async (file) => `data:${file.type};base64,AAAA`,
  });
  const images = await uploadImages(files, { onProgress: (value) => progress.push(value.percentage) });

  assert.deepEqual(images, [
    { url: 'data:image/png;base64,AAAA', alt: 'first', provider: 'local-data-url', mimeType: 'image/png', size: 4 },
    { url: 'data:image/webp;base64,AAAA', alt: 'second', provider: 'local-data-url', mimeType: 'image/webp', size: 4 },
  ]);
  assert.equal(progress.at(-1), 100);
});

test('playground rejects non-image embedded data', async () => {
  const uploadImages = createLocalImageUploader({ readFile: async () => 'data:text/plain;base64,AAAA' });
  await assert.rejects(
    uploadImages([{ name: 'fake.png', type: 'image/png', size: 4 }], { onProgress() {} }),
    /Unsupported embedded image/,
  );
});
