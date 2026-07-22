import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MARKDOWN, STORAGE_KEY, clearDocument, loadDocument, saveDocument } from '../playground/storage.js';
import { embedImages } from '../playground/images.js';

const makeStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
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

test('playground embeds images as self-contained data URLs', async () => {
  const files = [{ name: 'first.png' }, { name: 'second.webp' }];
  const progress = [];
  const images = await embedImages(
    files,
    (value) => progress.push(value.progress),
    async (file) => `data:image/${file.name.endsWith('.png') ? 'png' : 'webp'};base64,AAAA`,
  );

  assert.deepEqual(images, [
    { url: 'data:image/png;base64,AAAA', alt: 'first' },
    { url: 'data:image/webp;base64,AAAA', alt: 'second' },
  ]);
  assert.equal(progress.at(-1), 100);
});

test('playground rejects non-image embedded data', async () => {
  await assert.rejects(
    embedImages([{ name: 'fake.png' }], undefined, async () => 'data:text/plain;base64,AAAA'),
    /Unsupported embedded image/,
  );
});
