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

const readFileAsDataUrl = (file, signal) => new Promise((resolve, reject) => {
  throwIfAborted(signal);
  const reader = new FileReader();
  const cleanup = () => signal?.removeEventListener('abort', cancel);
  const cancel = () => reader.abort();
  reader.addEventListener('load', () => { cleanup(); resolve(reader.result); });
  reader.addEventListener('error', () => { cleanup(); reject(reader.error || new Error(`Unable to read ${file.name}`)); });
  reader.addEventListener('abort', () => { cleanup(); reject(abortError()); });
  signal?.addEventListener('abort', cancel, { once: true });
  reader.readAsDataURL(file);
});

const uploadContext = (context) => ({
  signal: context?.signal,
  onProgress: typeof context === 'function' ? context : (context?.onProgress || noop),
});

export const createLocalImageUploader = (options = {}) => {
  const readFile = options.readFile || readFileAsDataUrl;
  const provider = options.provider || 'local-data-url';
  const supportedDataUrl = options.dataUrlPattern || /^data:image\/(?:jpeg|png|webp|gif|svg\+xml);base64,/i;

  return async (files, context = {}) => {
    const items = Array.from(files || []);
    const { signal, onProgress } = uploadContext(context);
    const total = items.reduce((sum, file) => sum + (Number(file.size) || 1), 0);
    let loaded = 0;
    const images = [];

    throwIfAborted(signal);
    for (const file of items) {
      const percentage = total ? Math.round((loaded / total) * 100) : 0;
      onProgress({ file, loaded, total, percentage, progress: percentage, status: 'uploading' });
      const url = await readFile(file, signal);
      throwIfAborted(signal);
      if (typeof url !== 'string' || !supportedDataUrl.test(url)) {
        throw new Error(`Unsupported embedded image: ${file.name}`);
      }
      loaded += Number(file.size) || 1;
      images.push({
        url,
        alt: file.name.replace(/\.[^.]+$/, '') || 'image',
        provider,
        mimeType: file.type || undefined,
        size: Number(file.size) || undefined,
      });
    }

    onProgress({
      file: items.length === 1 ? items[0] : undefined,
      name: items.length === 1 ? items[0]?.name : `${items.length} images`,
      loaded: total,
      total,
      percentage: 100,
      progress: 100,
      status: 'success',
    });
    return images;
  };
};
