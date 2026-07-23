export const STORAGE_KEY = 'nonomark:playground:document:v1';
export const SNAPSHOTS_KEY = 'nonomark:playground:snapshots:v1';
export const DEFAULT_MARKDOWN = '';
export const DEFAULT_STORAGE_BUDGET = 5 * 1024 * 1024;
export const DEFAULT_MAX_SNAPSHOTS = 5;
export const DEFAULT_SNAPSHOT_INTERVAL = 30_000;

const stringBytes = (value, bytesPerCharacter = 2) => String(value ?? '').length * bytesPerCharacter;

const safeGet = (storage, key) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const loadDocument = (storage) => {
  try {
    const value = JSON.parse(safeGet(storage, STORAGE_KEY) || 'null');
    if (typeof value?.content === 'string') {
      return { content: value.content, updatedAt: Number(value.updatedAt) || null };
    }
  } catch {
    // A corrupt browser entry should never block the editor from opening.
  }
  return { content: DEFAULT_MARKDOWN, updatedAt: null };
};

export const saveDocument = (storage, content, updatedAt = Date.now()) => {
  const document = { content: String(content ?? ''), updatedAt };
  storage?.setItem(STORAGE_KEY, JSON.stringify(document));
  return document;
};

export const clearDocument = (storage) => storage?.removeItem(STORAGE_KEY);

export const loadSnapshots = (storage) => {
  try {
    const value = JSON.parse(safeGet(storage, SNAPSHOTS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter((snapshot) => typeof snapshot?.content === 'string' && Number(snapshot.updatedAt) > 0)
      .map((snapshot) => ({ content: snapshot.content, updatedAt: Number(snapshot.updatedAt) }));
  } catch {
    return [];
  }
};

export const saveSnapshot = (storage, content, updatedAt = Date.now(), options = {}) => {
  const value = String(content ?? '');
  if (!value) return loadSnapshots(storage);

  const maxSnapshots = Math.max(1, Number(options.maxSnapshots) || DEFAULT_MAX_SNAPSHOTS);
  const maxBytes = Math.max(1, Number(options.maxBytes) || 3 * 1024 * 1024);
  const existing = loadSnapshots(storage);
  if (existing[0]?.content === value) return existing;

  const snapshots = [
    { content: value, updatedAt },
    ...existing.filter((snapshot) => snapshot.content !== value),
  ].slice(0, maxSnapshots);

  while (snapshots.length && stringBytes(JSON.stringify(snapshots)) > maxBytes) snapshots.pop();
  storage?.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  return snapshots;
};

export const shouldCreateSnapshot = (
  snapshots,
  content,
  now = Date.now(),
  interval = DEFAULT_SNAPSHOT_INTERVAL,
) => {
  const value = String(content ?? '');
  if (!value || snapshots?.[0]?.content === value) return false;
  if (!snapshots?.length) return true;
  return now - Number(snapshots[0].updatedAt || 0) >= interval;
};

export const estimateStorageBytes = (storage, overrides = {}, bytesPerCharacter = 2) => {
  const values = new Map();
  try {
    for (let index = 0; index < (storage?.length || 0); index += 1) {
      const key = storage.key(index);
      if (key != null) values.set(key, storage.getItem(key) || '');
    }
  } catch {
    // The known nonoMark keys below still provide a useful conservative estimate.
  }

  for (const key of [STORAGE_KEY, SNAPSHOTS_KEY]) {
    if (!values.has(key)) {
      const value = safeGet(storage, key);
      if (value != null) values.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) values.set(key, String(value ?? ''));

  let bytes = 0;
  for (const [key, value] of values) bytes += stringBytes(key, bytesPerCharacter) + stringBytes(value, bytesPerCharacter);
  return bytes;
};

export const getStorageHealth = (
  storage,
  nextContent,
  budgetBytes = DEFAULT_STORAGE_BUDGET,
  bytesPerCharacter = 2,
) => {
  const current = loadDocument(storage);
  const serialized = JSON.stringify({ content: String(nextContent ?? ''), updatedAt: current.updatedAt || Date.now() });
  const projectedBytes = estimateStorageBytes(storage, { [STORAGE_KEY]: serialized }, bytesPerCharacter);
  const ratio = budgetBytes > 0 ? projectedBytes / budgetBytes : 1;
  const level = ratio >= 0.9 ? 'danger' : ratio >= 0.75 ? 'warning' : 'ok';
  return { level, projectedBytes, budgetBytes, ratio, remainingBytes: Math.max(0, budgetBytes - projectedBytes) };
};
