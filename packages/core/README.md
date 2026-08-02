# @nonoim/editor-core

Framework-independent Markdown compatibility checks, editor recovery backups and image upload contracts for nonoMark.

## Recovery backups

`createEditorBackup` stores a JSON-serializable editor payload under one stable `backupKey`. It does not know about Vue, React, PocketBase, authentication or a particular form shape.

```js
import { createEditorBackup } from '@nonoim/editor-core/backup';

const backup = createEditorBackup({
  backupKey: 'admin-42:posts:post-123',
  debounceMs: 800,
  onStatus: ({ status }) => console.log(status),
  onError: ({ operation, error }) => console.error(operation, error),
});

const pending = await backup.discover();
if (pending) {
  // Let the host UI offer: restore() or discard().
}

backup.schedule({
  title: form.title,
  summary: form.summary,
  markdown: form.markdown,
  category: form.category,
  seo: form.seo,
});

const restoredForm = await backup.restore();

await saveForm();
await backup.clear();
```

The default adapter is browser `localStorage`. Pass any `getItem` / `setItem` / `removeItem` adapter to use another storage mechanism. `flush()` immediately persists a scheduled payload, while `destroy()` cancels a pending timer without deleting an existing backup.

Backups contain JSON data only. `File`, `Blob`, DOM nodes and other non-JSON values must remain in the host application. The host owns recovery prompts, applying restored data and deciding when a formal save has succeeded.

## Remote image imports

The core exports `findRemoteImageReferences`, `replaceRemoteImageReferences`, and `importRemoteImagesFromContent`. They detect `http`/`https` images in one Markdown or HTML fragment, skip code and local/data URLs, and replace only results returned by a host callback.

```ts
const result = await importRemoteImagesFromContent(markdown, async (images, { signal }) => {
  return hostImport(images, { signal });
}, context);
```

Return each successful asset with its input reference `id`. A missing result preserves the original URL. This package does not download images, authenticate requests, or depend on a storage provider.
