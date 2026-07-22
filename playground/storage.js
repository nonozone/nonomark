export const STORAGE_KEY = 'nonomark:playground:document:v1';

export const DEFAULT_MARKDOWN = '';

export const loadDocument = (storage) => {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
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
