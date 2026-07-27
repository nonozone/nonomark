const noop = () => {};

const abortError = () => {
  if (typeof DOMException === 'function') return new DOMException('Image upload was cancelled.', 'AbortError');
  const error = new Error('Image upload was cancelled.');
  error.name = 'AbortError';
  return error;
};

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw abortError();
};

const resolveContext = (context) => ({ signal: context?.signal, onProgress: typeof context === 'function' ? context : (context?.onProgress || noop) });
const percentage = (loaded, total) => (total > 0 ? Math.round((loaded / total) * 100) : 0);
const setHeaders = (request, values) => { const headers = new Headers(values || {}); for (const [name, value] of headers) request.setRequestHeader(name, value); };

export const uploadWithXhr = ({ uploadUrl, method = 'PUT', headers, file, signal, onProgress = noop, withCredentials = false, timeout = 0 }) => new Promise((resolve, reject) => {
  throwIfAborted(signal);
  if (typeof XMLHttpRequest !== 'function') { reject(new Error('XMLHttpRequest is unavailable. Provide a custom uploadRequest transport.')); return; }
  const request = new XMLHttpRequest();
  const cleanup = () => signal?.removeEventListener('abort', cancel);
  const fail = (error) => { cleanup(); reject(error); };
  const cancel = () => request.abort();
  request.open(method, uploadUrl, true);
  request.withCredentials = Boolean(withCredentials);
  request.timeout = Math.max(0, Number(timeout) || 0);
  setHeaders(request, headers);
  request.upload.addEventListener('progress', (event) => onProgress(event.loaded, event.lengthComputable ? event.total : (Number(file?.size) || event.loaded)));
  request.addEventListener('load', () => { cleanup(); if (request.status >= 200 && request.status < 300) resolve(); else reject(new Error(`Image upload failed with HTTP ${request.status}.`)); });
  request.addEventListener('error', () => fail(new Error('Image upload failed because of a network error.')));
  request.addEventListener('timeout', () => fail(new Error('Image upload timed out.')));
  request.addEventListener('abort', () => fail(abortError()));
  signal?.addEventListener('abort', cancel, { once: true });
  request.send(file);
});

const requireUploadRequest = (value) => {
  if (!value || typeof value.uploadUrl !== 'string' || !value.uploadUrl || typeof value.publicUrl !== 'string' || !value.publicUrl) throw new Error('getUploadRequest must return non-empty uploadUrl and publicUrl values.');
  return value;
};
const addOptional = (asset, key, value) => { if (value !== undefined && value !== null && value !== '') asset[key] = value; };

export const createS3ImageUploader = (options = {}) => {
  if (typeof options.getUploadRequest !== 'function') throw new TypeError('createS3ImageUploader requires getUploadRequest.');
  const uploadRequest = options.uploadRequest || uploadWithXhr;
  const defaultProvider = options.provider || 's3';
  return async (files, context = {}) => {
    const items = Array.from(files || []);
    const { signal, onProgress } = resolveContext(context);
    const total = items.reduce((sum, item) => sum + (Number(item.size) || 1), 0);
    let completed = 0;
    const assets = [];
    throwIfAborted(signal);
    for (const [index, file] of items.entries()) {
      const prepared = requireUploadRequest(await options.getUploadRequest(file, { signal, index }));
      throwIfAborted(signal);
      const size = Number(file.size) || 1;
      const report = (fileLoaded = 0) => {
        const loaded = Math.min(total, completed + Math.max(0, Math.min(size, Number(fileLoaded) || 0)));
        const value = percentage(loaded, total);
        onProgress({ file, loaded, total, percentage: value, progress: value, status: 'uploading' });
      };
      report(0);
      await uploadRequest({ uploadUrl: prepared.uploadUrl, method: prepared.method || 'PUT', headers: prepared.headers || (file.type ? { 'content-type': file.type } : undefined), file, signal, onProgress: report, withCredentials: prepared.withCredentials, timeout: prepared.timeout });
      throwIfAborted(signal);
      report(size);
      completed += size;
      const asset = { url: prepared.publicUrl, alt: prepared.alt || file.name.replace(/\.[^.]+$/, '') || 'image', provider: prepared.provider || defaultProvider, mimeType: file.type || undefined, size: Number(file.size) || undefined };
      addOptional(asset, 'title', prepared.title); addOptional(asset, 'id', prepared.id); addOptional(asset, 'key', prepared.key);
      assets.push(asset);
    }
    onProgress({ file: items.length === 1 ? items[0] : undefined, name: items.length === 1 ? items[0]?.name : `${items.length} images`, loaded: total, total, percentage: 100, progress: 100, status: 'success' });
    return assets;
  };
};
