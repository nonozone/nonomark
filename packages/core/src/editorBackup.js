const BACKUP_VERSION = 1;
const DEFAULT_PREFIX = 'nonoMark:editor-backup:';

const isStorageAdapter = (storage) => storage
  && typeof storage.getItem === 'function'
  && typeof storage.setItem === 'function'
  && typeof storage.removeItem === 'function';

const copyJsonValue = (value) => {
  const serialized = JSON.stringify(value, (_key, currentValue) => {
    const isFile = typeof File !== 'undefined' && currentValue instanceof File;
    const isBlob = typeof Blob !== 'undefined' && currentValue instanceof Blob;
    if (isFile || isBlob) {
      throw new TypeError('Editor backup payload cannot contain File or Blob values.');
    }
    return currentValue;
  });
  if (typeof serialized !== 'string') throw new TypeError('Editor backup payload must be JSON serializable.');
  return JSON.parse(serialized);
};

export const createEditorBackup = (options = {}) => {
  const backupKey = typeof options.backupKey === 'string' ? options.backupKey.trim() : '';
  if (!backupKey) throw new TypeError('Editor backup requires a non-empty backupKey.');
  if (options.storage !== undefined && !isStorageAdapter(options.storage)) {
    throw new TypeError('Editor backup storage must implement getItem, setItem and removeItem.');
  }

  const debounceMs = options.debounceMs ?? 1000;
  if (!Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new TypeError('Editor backup debounceMs must be a non-negative finite number.');
  }

  const storageKey = `${options.prefix ?? DEFAULT_PREFIX}${encodeURIComponent(backupKey)}`;
  const listeners = new Set();
  const now = options.now ?? Date.now;
  let status = 'idle';
  let lastError = null;
  let lastBackup = null;
  let pendingPayload;
  let hasPendingPayload = false;
  let timer = null;
  let destroyed = false;

  const resolveStorage = () => {
    if (options.storage) return options.storage;
    let browserStorage;
    try {
      browserStorage = globalThis.localStorage;
    } catch (error) {
      throw new Error('Browser storage is unavailable for editor backup.', { cause: error });
    }
    if (!isStorageAdapter(browserStorage)) {
      throw new Error('Editor backup requires browser localStorage or a custom storage adapter.');
    }
    return browserStorage;
  };

  const emit = (event) => {
    for (const listener of listeners) listener(event);
  };

  const setStatus = (nextStatus, details = {}) => {
    status = nextStatus;
    const event = { type: 'status', status, backupKey, ...details };
    options.onStatus?.(event);
    emit(event);
  };

  const reportError = (operation, error) => {
    lastError = error;
    const event = { type: 'error', operation, error, backupKey };
    setStatus('error', { operation, error });
    options.onError?.(event);
    emit(event);
  };

  const assertActive = () => {
    if (destroyed) throw new Error('Editor backup controller has been destroyed.');
  };

  const cancelPending = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingPayload = undefined;
    hasPendingPayload = false;
  };

  const parseEntry = (raw) => {
    const entry = JSON.parse(raw);
    if (
      !entry
      || entry.version !== BACKUP_VERSION
      || entry.backupKey !== backupKey
      || typeof entry.savedAt !== 'string'
      || !Object.prototype.hasOwnProperty.call(entry, 'payload')
    ) {
      throw new Error('Stored editor backup has an unsupported format.');
    }
    return entry;
  };

  const persist = async (payload) => {
    assertActive();
    setStatus('saving');
    try {
      const entry = {
        version: BACKUP_VERSION,
        backupKey,
        savedAt: new Date(now()).toISOString(),
        payload: copyJsonValue(payload),
      };
      const serialized = JSON.stringify(entry);
      await resolveStorage().setItem(storageKey, serialized);
      lastBackup = parseEntry(serialized);
      lastError = null;
      const publicEntry = copyJsonValue(lastBackup);
      setStatus('saved', { entry: publicEntry });
      return publicEntry;
    } catch (error) {
      reportError('save', error);
      throw error;
    }
  };

  const controller = {
    backupKey,
    storageKey,
    get status() { return status; },
    get error() { return lastError; },
    get lastBackup() { return lastBackup ? copyJsonValue(lastBackup) : null; },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Editor backup listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    schedule(payload) {
      assertActive();
      if (timer !== null) clearTimeout(timer);
      pendingPayload = payload;
      hasPendingPayload = true;
      setStatus('scheduled');
      timer = setTimeout(() => {
        timer = null;
        const nextPayload = pendingPayload;
        pendingPayload = undefined;
        hasPendingPayload = false;
        void persist(nextPayload).catch(() => undefined);
      }, debounceMs);
    },
    async save(payload) {
      assertActive();
      cancelPending();
      return persist(payload);
    },
    async flush() {
      assertActive();
      if (!hasPendingPayload) return null;
      const nextPayload = pendingPayload;
      cancelPending();
      return persist(nextPayload);
    },
    async discover() {
      assertActive();
      setStatus('checking');
      try {
        const raw = await resolveStorage().getItem(storageKey);
        if (raw === null || raw === undefined) {
          lastBackup = null;
          lastError = null;
          setStatus('idle');
          return null;
        }
        lastBackup = parseEntry(raw);
        lastError = null;
        const publicEntry = copyJsonValue(lastBackup);
        setStatus('available', { entry: publicEntry });
        return publicEntry;
      } catch (error) {
        reportError('discover', error);
        throw error;
      }
    },
    async restore() {
      assertActive();
      const entry = lastBackup ?? await controller.discover();
      if (!entry) return null;
      const payload = copyJsonValue(entry.payload);
      setStatus('restored', { entry: copyJsonValue(entry) });
      return payload;
    },
    async clear() {
      assertActive();
      cancelPending();
      try {
        await resolveStorage().removeItem(storageKey);
        lastBackup = null;
        lastError = null;
        setStatus('cleared');
      } catch (error) {
        reportError('clear', error);
        throw error;
      }
    },
    async discard() {
      assertActive();
      cancelPending();
      try {
        await resolveStorage().removeItem(storageKey);
        lastBackup = null;
        lastError = null;
        setStatus('discarded');
      } catch (error) {
        reportError('discard', error);
        throw error;
      }
    },
    destroy() {
      if (destroyed) return;
      cancelPending();
      destroyed = true;
      setStatus('destroyed');
      listeners.clear();
    },
  };

  return controller;
};
