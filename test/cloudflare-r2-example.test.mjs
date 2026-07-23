import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../examples/cloudflare-r2/src/index.js';

const makeEnv = () => {
  const objects = new Map();
  const readObject = (key, includeBody) => {
    const value = objects.get(key);
    if (!value) return null;
    return {
      ...(includeBody ? { body: value.body } : {}),
      httpEtag: '"test-etag"',
      writeHttpMetadata: (headers) => headers.set('content-type', value.options.httpMetadata.contentType),
    };
  };
  return {
    AUTH: { fetch: async () => new Response(null, { status: 204 }) },
    IMAGES: {
      put: async (key, body, options) => { objects.set(key, { body, options }); },
      get: async (key) => readObject(key, true),
      head: async (key) => readObject(key, false),
    },
    PUBLIC_BASE_URL: 'https://images.example.com',
    MAX_IMAGE_BYTES: '1024',
    objects,
  };
};

test('Cloudflare example authenticates, validates, streams to R2 and serves the image', async () => {
  const env = makeEnv();
  const metadata = JSON.stringify({ name: 'photo.png', type: 'image/png', size: 4 });
  const prepare = await worker.fetch(new Request('https://app.example.com/api/images/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(metadata.length), cookie: 'session=test' },
    body: metadata,
  }), env);
  assert.equal(prepare.status, 200);
  const request = await prepare.json();
  assert.match(request.key, /^images\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/);
  assert.equal(request.publicUrl, `https://images.example.com/images/${request.key}`);

  const upload = await worker.fetch(new Request(request.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/png', 'content-length': '4', cookie: 'session=test' },
    body: new Uint8Array([1, 2, 3, 4]),
  }), env);
  assert.equal(upload.status, 204);
  assert.equal(env.objects.get(request.key).options.httpMetadata.contentType, 'image/png');

  const served = await worker.fetch(new Request(request.publicUrl), env);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('etag'), '"test-etag"');

  const head = await worker.fetch(new Request(request.publicUrl, { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'image/png');
  assert.equal(await head.text(), '');
});

test('Cloudflare example rejects unauthenticated preparation and oversized uploads', async () => {
  const env = makeEnv();
  env.AUTH.fetch = async () => new Response(null, { status: 401 });
  const denied = await worker.fetch(new Request('https://app.example.com/api/images/prepare', {
    method: 'POST',
    headers: { 'content-length': '2' },
    body: '{}',
  }), env);
  assert.equal(denied.status, 401);

  env.AUTH.fetch = async () => new Response(null, { status: 204 });
  const oversized = await worker.fetch(new Request('https://app.example.com/api/images/upload/images/2026/07/00000000-0000-4000-8000-000000000000.png', {
    method: 'PUT',
    headers: { 'content-type': 'image/png', 'content-length': '2048' },
    body: new Uint8Array([1]),
  }), env);
  assert.equal(oversized.status, 413);
});
