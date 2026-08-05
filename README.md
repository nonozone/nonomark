# nonoMark

[![CI](https://github.com/nonozone/nonomark/actions/workflows/ci.yml/badge.svg)](https://github.com/nonozone/nonomark/actions/workflows/ci.yml)

A lightweight, dependable Markdown editor for Vue 3 and React, built with official Tiptap adapters. Markdown remains the application contract; authentication and formal persistence stay in the host application. An optional framework-independent recovery controller protects unsaved editor state in browser storage.

Try the distraction-free editor at [nonozone.github.io/nonomark](https://nonozone.github.io/nonomark/).

## Packages

| Package | Purpose |
| --- | --- |
| `@nonoim/editor-core` | Framework-independent Markdown, recovery backup and image upload contracts |
| `@nonoim/editor-vue` | Official Vue 3 editor |
| `@nonoim/editor-react` | Official React editor |
| `@nonoim/editor` | Compatibility package for existing Vue projects |

## Vue

```bash
npm install @nonoim/editor-vue
```

```vue
<script setup>
import { ref } from 'vue';
import { NonoEditor } from '@nonoim/editor-vue';
import '@nonoim/editor-vue/style.css';

const content = ref('## Hello');
</script>

<template>
  <NonoEditor v-model="content" locale="zh" />
</template>
```

Existing `@nonoim/editor` applications remain supported in 0.4.x and can migrate by changing the package name.

## React

```bash
npm install @nonoim/editor-react
```

```jsx
import { useState } from 'react';
import { NonoEditor } from '@nonoim/editor-react';
import '@nonoim/editor-react/style.css';

export function ArticleEditor() {
  const [content, setContent] = useState('## Hello');
  return <NonoEditor value={content} onChange={setContent} locale="zh" />;
}
```

React uses `value`/`onChange`; Vue uses `v-model`. Both adapters share Markdown protection and the same `uploadImages` contract.

## Recovery backups

Recovery backups are independent from the Markdown component. One controller owns one stable `backupKey` and can store the complete host form, including titles, summaries, taxonomy and SEO fields alongside Markdown.

```js
import { createEditorBackup } from '@nonoim/editor-core/backup';

const backup = createEditorBackup({
  backupKey: `${adminId}:posts:${recordId}`,
  debounceMs: 800,
  onStatus: (event) => updateBackupStatus(event.status),
  onError: (event) => reportBackupError(event.error),
});

const found = await backup.discover();
if (found && await confirmRestore()) {
  form = await backup.restore();
} else if (found) {
  await backup.discard();
}

// Call whenever the complete editor form changes.
backup.schedule(form);

// Call only after the host's formal save succeeds.
await backup.clear();
```

Different Markdown editors do not collide when they use different keys. The controller exposes `idle`, `scheduled`, `saving`, `saved`, `available`, `restored`, `discarded`, `cleared`, `error` and `destroyed` states, plus status/error events. It uses `localStorage` by default and accepts a custom storage adapter, but has no PocketBase, Vue, React or application-specific dependency.

Payloads must be JSON-serializable. Image `File` objects are intentionally not stored; keep the host's existing unsaved-file warning and upload lifecycle.

## Vue props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `modelValue` | `string` | `''` | Markdown content used by `v-model` |
| `placeholder` | `string` | localized | Empty-editor hint and accessible label |
| `rows` | `number` | `10` | Requested minimum editor height |
| `fill` | `boolean` | `false` | Fill a flex container |
| `disabled` | `boolean` | `false` | Disable editing and mode changes |
| `readonly` | `boolean` | `false` | Prevent edits while allowing source inspection |
| `autofocus` | `boolean` | `false` | Focus the visual editor after mounting |
| `allowBase64Images` | `boolean` | `false` | Allow embedded data-URL images; intended for local/offline documents |
| `locale` | `string` | `'en'` | Built-in English or `zh-*` interface copy |
| `help` | `string` | `''` | Help text below the editor |
| `uploadImages` | `UploadImages \| null` | `null` | Host-provided local-file upload function |
| `importRemoteImages` | `ImportRemoteImages \| null` | `null` | Host-provided remote-image import function used only during paste |
| `imageAccept` | `string` | common web images | Accepted MIME types |
| `maxImageSize` | `number` | `10 MiB` | Client-side size limit per image |

Events: `update:modelValue`, `warning`, `upload-complete`, `upload-error`, and `upload-cancel`.

Remote-image events: `remote-image-import-start`, `remote-image-import-complete`, and `remote-image-import-error`.

Named slots: `toolbar-end` adds host-specific actions to the end of the formatting toolbar, and `footer-status` adds a compact host status beside the Markdown mode indicator.

## Images

`uploadImages` is a storage-provider-neutral contract. Selecting, pasting or dropping images uses the same function, and only one batch runs at a time. Resolve to assets with at least a stable `url`; optional `provider`, `key`, MIME and size metadata is preserved in upload events for host-side migration or bookkeeping.

In visual mode, click an image to select it. The selected image receives a visible outline and can be removed with `Delete` or `Backspace`.

```ts
type UploadImages = (
  files: File[],
  context: {
    signal: AbortSignal
    onProgress(progress: {
      file?: File
      loaded?: number
      total?: number
      percentage?: number
    }): void
  }
) => Promise<Array<{
  url: string
  alt?: string
  title?: string
  id?: string
  provider?: string
  key?: string
  mimeType?: string
  size?: number
}>>
```

For S3, Cloudflare R2, MinIO and other S3-compatible storage, import the optional adapter from its independent package entry. Your host endpoint returns a presigned PUT request; the adapter performs the upload with byte progress and cancellation support.

```js
import { createS3ImageUploader } from '@nonoim/editor-core/upload-s3';

const uploadImages = createS3ImageUploader({
  provider: 's3',
  getUploadRequest: async (file, { signal }) => {
    const response = await fetch('/api/images/presign', {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
    });
    if (!response.ok) throw new Error(`Unable to prepare upload (${response.status}).`);
    return response.json();
  },
});
```

The response supplies `uploadUrl`, `publicUrl`, and optionally `method`, `headers`, `key`, `provider`, `alt`, `title`, `withCredentials`, and `timeout`. See the authenticated [Cloudflare R2 Worker example](examples/cloudflare-r2/) for an end-to-end backend that keeps cloud credentials out of the browser.

The editor creates one `AbortSignal` per batch and exposes a cancel action while uploading. Providers must pass the signal to their network or file-reading operations. The editor never receives cloud access keys and never deletes remote objects; signing, authorization, retries, CDN URLs and cleanup remain host responsibilities. The editor inserts a batch only after every file succeeds, but objects uploaded before a later failure can remain in remote storage, so the host should expire or clean up unreferenced objects.

### Local/offline images

The built-in local adapter uses the same contract and returns self-contained data URLs:

```js
import { createLocalImageUploader } from '@nonoim/editor';

const uploadImages = createLocalImageUploader();
```

```vue
<NonoEditor
  v-model="content"
  allow-base64-images
  :upload-images="uploadImages"
/>
```

Because Base64 increases document size, it is intended for offline or small local documents. A later migration can scan `data:image/...` URLs, upload each blob through a cloud provider, and replace the Markdown URLs without changing the editor.

The previous callable progress parameter remains compatible: `uploadImages(files, onProgress)` implementations continue to work. New providers should use `{ signal, onProgress }`, emit `percentage` rather than the deprecated `progress` alias, and treat `AbortError` as cancellation.

The host must still validate file content, authorization and size on the server. Browser validation is only a usability check.

### Importing remote images from pasted content

When `importRemoteImages` is provided, both adapters inspect only the current paste payload for Markdown images and HTML `<img>` elements whose source uses `http` or `https`. Code spans, fenced code blocks, data URLs, blob URLs and relative paths are ignored. The editor sends the references to the host and replaces only successfully imported URLs, preserving the original `alt`, `title` and surrounding Markdown or HTML.

```ts
const importRemoteImages: ImportRemoteImages = async (images, { signal }) => {
  const response = await fetch('/api/images/import', {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ images }),
  });
  if (!response.ok) throw new Error(`Unable to import images (${response.status}).`);
  return response.json();
};
```

Return assets with the input reference `id` and the new `url`. Keeping the `id` is required when a batch can partially succeed; missing results retain their original URL. If the whole callback rejects, the editor inserts the original pasted content and emits the error event. The callback receives a standard `AbortSignal`, while authentication, remote downloading, SSRF protection, size and MIME validation, storage selection, and cleanup remain entirely host responsibilities.

## Markdown compatibility

The visual editor supports headings, paragraphs, emphasis, strike-through, links, lists, quotes, inline/fenced code, images and tables. The test suite verifies representative documents survive a visual Markdown round trip.

These features currently stay in source mode because Tiptap cannot preserve them reliably with the configured extensions:

- task lists (`- [ ] item`)
- YAML or TOML frontmatter
- footnotes
- raw HTML

`findUnsupportedMarkdown(markdown)` returns the detected feature names and `requiresSourceMode(markdown)` reports whether visual editing would be lossy. Unsupported syntax is never silently converted.

## Styling

Import `@nonoim/editor/style.css`. The main theme variables can be overridden on a wrapping element:

```css
.my-editor {
  --nono-editor-primary: #7c3aed;
  --nono-editor-border: #d4d4d8;
  --nono-editor-heading: #18181b;
  --nono-editor-text: #27272a;
  --nono-editor-muted: #71717a;
}
```

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
npm pack --dry-run --ignore-scripts
```

### Playground

Public demo: [https://nonozone.github.io/nonomark/](https://nonozone.github.io/nonomark/)

Run the local-first writing workspace at `http://127.0.0.1:4173`:

```bash
npm run playground
```

The Playground is a distraction-free, full-screen editor. It automatically saves one Markdown document to browser storage and embeds uploaded images directly into Markdown as data URLs, so it needs no backend and does not upload content. Demo images are limited to 1 MiB each because browser storage is intentionally small.

The compact **File** menu can import and export `.md` files, start a guarded blank document, and restore recent deduplicated snapshots. Destructive actions snapshot the current document first. The footer reports saving failures and warns when the projected local storage use approaches a conservative 5 MiB budget; exporting Markdown remains the durable backup path.

Create its static production build with `npm run build:playground`. Output is written to `playground-dist/` and is ready for a later GitHub Pages deployment.

The generated editor wrapper is small, but Tiptap packages are externalized from the library build. Measure the final host application bundle when evaluating total browser weight.

MIT licensed.
