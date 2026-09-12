# @nonoim/editor-react

The official React adapter for nonoMark. It shares Markdown protection and image upload contracts with the Vue adapter.

```jsx
import { NonoEditor } from '@nonoim/editor-react';
import '@nonoim/editor-react/style.css';

<NonoEditor value={markdown} onChange={setMarkdown} />
```

Use `importRemoteImages={importRemoteImages}` to let the host import `http`/`https` images found in the current Markdown or HTML paste. Successful assets should return the input reference `id`; storage and download security remain host responsibilities.

For admin pages that must render before Tiptap finishes loading, use the lazy entry:

```jsx
import { NonoLazyEditor, preloadNonoEditor } from '@nonoim/editor-react/lazy';

<NonoLazyEditor value={markdown} onChange={setMarkdown} />
```

The fallback is an editable controlled textarea. Call `preloadNonoEditor()` on route intent or during browser idle time to warm the full editor chunk.
