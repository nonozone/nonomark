import test from 'node:test';
import assert from 'node:assert/strict';
import { createS3ImageUploader } from '../src/uploadS3.js';

const file = (name, size, type = 'image/png') => ({ name, size, type });
const context = (signal, values) => Object.assign(
  (value) => values.push(value),
  { signal, onProgress: (value) => values.push(value) },
);

test('S3 adapter prepares and uploads files with aggregate byte progress', async () => {
  const prepared = [];
  const uploaded = [];
  const progress = [];
  const controller = new AbortController();
  const uploadImages = createS3ImageUploader({
    provider: 'cloudflare-r2',
    getUploadRequest: async (image, { signal }) => {
      prepared.push({ image, signal });
      return {
        uploadUrl: `https://upload.example/${image.name}`,
        publicUrl: `https://images.example/${image.name}`,
        key: `images/${image.name}`,
        headers: { 'content-type': image.type },
      };
    },
    uploadRequest: async (request) => {
      uploaded.push(request);
      request.onProgress(request.file.size);
    },
  });

  const assets = await uploadImages(
    [file('one.png', 4), file('two.png', 6)],
    context(controller.signal, progress),
  );

  assert.equal(prepared.length, 2);
  assert.equal(prepared[0].signal, controller.signal);
  assert.equal(uploaded[0].method, 'PUT');
  assert.equal(uploaded[0].headers['content-type'], 'image/png');
  assert.deepEqual(assets, [
    { url: 'https://images.example/one.png', alt: 'one', provider: 'cloudflare-r2', key: 'images/one.png', mimeType: 'image/png', size: 4 },
    { url: 'https://images.example/two.png', alt: 'two', provider: 'cloudflare-r2', key: 'images/two.png', mimeType: 'image/png', size: 6 },
  ]);
  assert.deepEqual(
    progress.at(-1),
    { file: undefined, name: '2 images', loaded: 10, total: 10, percentage: 100, progress: 100, status: 'success' },
  );
});

test('S3 adapter validates prepared URLs and propagates cancellation', async () => {
  const invalid = createS3ImageUploader({ getUploadRequest: async () => ({}) });
  await assert.rejects(
    invalid([file('invalid.png', 4)], context(new AbortController().signal, [])),
    /uploadUrl.*publicUrl/,
  );

  const controller = new AbortController();
  const uploadImages = createS3ImageUploader({
    getUploadRequest: async () => ({ uploadUrl: 'https://upload.example/file', publicUrl: 'https://images.example/file' }),
    uploadRequest: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }),
  });
  const uploading = uploadImages([file('cancel.png', 4)], context(controller.signal, []));
  controller.abort();
  await assert.rejects(uploading, (error) => error?.name === 'AbortError');
});
