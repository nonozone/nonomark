# @nonoim/editor-js

Standalone browser entry for nonoMark. It mounts the same Markdown editor as the Vue and React packages, but the consuming application only needs ordinary JavaScript and a DOM element. Vue and Tiptap are bundled into the browser build.

## ESM

```html
<div id="editor"></div>
<script type="module">
  import createNonoEditor from 'https://cdn.jsdelivr.net/npm/@nonoim/editor-js/dist/editor-js.js';

  const editor = createNonoEditor('#editor', {
    value: '## Hello',
    locale: 'zh-CN',
    onChange(markdown) {
      console.log(markdown);
    },
  });

  window.saveMarkdown = () => editor.getValue();
</script>
```

## Script tag

Use the published IIFE file from a CDN when the project does not use a bundler:

```html
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/@nonoim/editor-js/dist/editor-js.iife.js"></script>
<script>
  const editor = NonoEditorJS.createNonoEditor('#editor', {
    value: '## Hello',
    onChange: markdown => console.log(markdown),
  });
</script>
```

The IIFE build injects the editor styles automatically.

`createNonoEditor` accepts a DOM element or a selector and returns `getValue()`, `setValue(markdown)`, `focus()`, and `destroy()` methods. Editor options match the common Vue/React props: `placeholder`, `rows`, `readonly`, `disabled`, `locale`, `uploadImages`, `importRemoteImages`, `imageAccept`, `maxImageSize`, `autoSourceMode`, and `enableGallery`. Use `onChange` for Markdown updates and the `onWarning`, upload, remote-image, and gallery callbacks for the corresponding events.
