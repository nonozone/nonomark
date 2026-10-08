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

In visual mode, select an image and click **Image properties** beside it. Alternative text (`alt`) and the optional visible caption are separate fields. Empty alt stays empty. **Use caption as alt** explicitly copies the caption when desired; typing a caption alone preserves alt. Apply affects only the selected occurrence; cancel, Escape, undo and redo are supported.

Uncaptioned images use standard Markdown; captioned images use portable HTML `<figure>`, `<img>`, and `<figcaption>` elements. The editor preserves alt, caption, URL and title through save/reopen and source/visual switching. Configure the article renderer to allow these HTML elements. Article edits do not update the host's image library.
