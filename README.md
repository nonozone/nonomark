# NonoMark

[![CI](https://github.com/nonozone/nonomark/actions/workflows/ci.yml/badge.svg)](https://github.com/nonozone/nonomark/actions/workflows/ci.yml)

A lightweight, dependable Vue 3 visual Markdown editor built with official Tiptap packages. Markdown remains the `v-model` contract; storage, authentication and autosave stay in the host application.

## Install

```bash
npm install @nonoim/editor
```

```vue
<script setup>
import { ref } from 'vue';
import { NonoEditor } from '@nonoim/editor';
import '@nonoim/editor/style.css';

const content = ref('## Hello');
</script>

<template>
  <NonoEditor v-model="content" locale="zh" />
</template>
```

## Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `modelValue` | `string` | `''` | Markdown content used by `v-model` |
| `placeholder` | `string` | localized | Empty-editor hint and accessible label |
| `rows` | `number` | `10` | Requested minimum editor height |
| `fill` | `boolean` | `false` | Fill a flex container |
| `disabled` | `boolean` | `false` | Disable editing and mode changes |
| `readonly` | `boolean` | `false` | Prevent edits while allowing source inspection |
| `autofocus` | `boolean` | `false` | Focus the visual editor after mounting |
| `locale` | `string` | `'en'` | Built-in English or `zh-*` interface copy |
| `help` | `string` | `''` | Help text below the editor |
| `uploadImages` | `UploadImages \| null` | `null` | Host-provided image upload function |
| `imageAccept` | `string` | common web images | Accepted MIME types |
| `maxImageSize` | `number` | `10 MiB` | Client-side size limit per image |

Events: `update:modelValue`, `warning`, `upload-complete`, and `upload-error`.

## Images

Provide `uploadImages(files, onProgress)` and resolve to `{ url, alt }[]`. Selecting, pasting or dropping images uses the same function. Only one upload batch runs at a time.

```js
const uploadImages = async (files, onProgress) => Promise.all(
  files.map(async (file) => {
    onProgress({ file, progress: 0 });
    const url = await uploadToYourStorage(file);
    onProgress({ file, progress: 100 });
    return { url, alt: file.name };
  }),
);
```

The host must still validate file content, authorization and size on the server. Browser validation is only a usability check.

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

The generated editor wrapper is small, but Tiptap packages are externalized from the library build. Measure the final host application bundle when evaluating total browser weight.

MIT licensed.
