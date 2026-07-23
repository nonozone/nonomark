const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const PREPARE_PATH = '/api/images/prepare';
const UPLOAD_PREFIX = '/api/images/upload/';
const PUBLIC_PREFIX = '/images/';

const json = (body, status = 200, headers) => Response.json(body, { status, headers });
const maxImageBytes = (env) => Math.max(1, Number(env.MAX_IMAGE_BYTES) || 10 * 1024 * 1024);
const safeKey = (key) => /^images\/[0-9]{4}\/[0-9]{2}\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/.test(key) && !key.includes('..');

const authenticate = async (request, env) => {
  const headers = new Headers();
  for (const name of ['authorization', 'cookie']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await env.AUTH.fetch('https://auth.internal/session', { headers });
  return response.ok;
};

const prepareUpload = async (request, env) => {
  if (!(await authenticate(request, env))) return json({ error: 'Unauthorized' }, 401);
  const requestBytes = Number(request.headers.get('content-length'));
  if (!requestBytes) return json({ error: 'Content-Length is required.' }, 411);
  if (requestBytes > 8192) return json({ error: 'Upload metadata is too large.' }, 413);

  const input = await request.json();
  const type = typeof input?.type === 'string' ? input.type : '';
  const size = Number(input?.size);
  const extension = IMAGE_TYPES.get(type);
  if (!extension) return json({ error: 'Unsupported image type.' }, 415);
  if (!Number.isFinite(size) || size <= 0 || size > maxImageBytes(env)) return json({ error: 'Invalid image size.' }, 413);

  const now = new Date();
  const key = `images/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${extension}`;
  const uploadUrl = new URL(`${UPLOAD_PREFIX}${key}`, request.url).toString();
  const publicUrl = new URL(`${PUBLIC_PREFIX}${key}`, env.PUBLIC_BASE_URL).toString();
  return json({ uploadUrl, publicUrl, key, method: 'PUT', withCredentials: true });
};

const uploadImage = async (request, env, key) => {
  if (!(await authenticate(request, env))) return json({ error: 'Unauthorized' }, 401);
  if (!safeKey(key)) return json({ error: 'Invalid image key.' }, 400);
  const type = request.headers.get('content-type') || '';
  const size = Number(request.headers.get('content-length'));
  if (!IMAGE_TYPES.has(type)) return json({ error: 'Unsupported image type.' }, 415);
  if (!Number.isFinite(size) || size <= 0 || size > maxImageBytes(env)) return json({ error: 'Invalid image size.' }, 413);
  if (!request.body) return json({ error: 'Image body is required.' }, 400);

  await env.IMAGES.put(key, request.body, {
    httpMetadata: {
      contentType: type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { uploadedAt: new Date().toISOString() },
  });
  return new Response(null, { status: 204 });
};

const serveImage = async (env, key, headOnly) => {
  if (!safeKey(key)) return new Response('Not found', { status: 404 });
  const object = headOnly ? await env.IMAGES.head(key) : await env.IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(headOnly ? null : object.body, { headers });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === PREPARE_PATH) return await prepareUpload(request, env);
      if (request.method === 'PUT' && url.pathname.startsWith(UPLOAD_PREFIX)) return await uploadImage(request, env, url.pathname.slice(UPLOAD_PREFIX.length));
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith(PUBLIC_PREFIX)) {
        return await serveImage(env, url.pathname.slice(PUBLIC_PREFIX.length), request.method === 'HEAD');
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error(JSON.stringify({ message: 'image route failed', path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'Image service failed.' }, 500);
    }
  },
};
