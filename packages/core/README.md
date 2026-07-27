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
