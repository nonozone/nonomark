import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalImageUploader } from '../packages/core/src/index.js';

const imageFile = (name, type, size = 4) => ({ name, type, size });

test('local image provider follows the public upload contract', async () => {
  const progress = [];
  const controller = new AbortController();
  const upload = createLocalImageUploader({
    readFile: async (file) => `data:${file.type};base64,AAAA`,
  });
  const context = Object.assign(
    (value) => progress.push(value),
    { signal: controller.signal, onProgress: (value) => progress.push(value) },
  );

  const images = await upload([
    imageFile('first.png', 'image/png'),
    imageFile('second.webp', 'image/webp'),
  ], context);

  assert.deepEqual(images, [
    { url: 'data:image/png;base64,AAAA', alt: 'first', provider: 'local-data-url', mimeType: 'image/png', size: 4 },
    { url: 'data:image/webp;base64,AAAA', alt: 'second', provider: 'local-data-url', mimeType: 'image/webp', size: 4 },
  ]);
  assert.equal(progress.at(-1).percentage, 100);
  assert.equal(progress.at(-1).progress, 100);
  assert.equal(progress.at(-1).total, 8);
});

test('local image provider rejects invalid data and respects cancellation', async () => {
  const invalid = createLocalImageUploader({ readFile: async () => 'data:text/plain;base64,AAAA' });
  await assert.rejects(
    invalid([imageFile('fake.png', 'image/png')], { onProgress() {} }),
    /Unsupported embedded image/,
  );

  const controller = new AbortController();
  controller.abort();
  const upload = createLocalImageUploader({ readFile: async () => 'data:image/png;base64,AAAA' });
  await assert.rejects(
    upload([imageFile('cancelled.png', 'image/png')], { signal: controller.signal, onProgress() {} }),
    (error) => error?.name === 'AbortError',
  );
});
