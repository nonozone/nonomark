# @nonoim/editor-vue

The official Vue 3 adapter for nonoMark. Existing `@nonoim/editor` projects can migrate by changing only the package name.

```js
import { NonoEditor } from '@nonoim/editor-vue';
import '@nonoim/editor-vue/style.css';
```

Use `:import-remote-images="importRemoteImages"` to let the host import `http`/`https` images found in the current Markdown or HTML paste. Successful assets should return the input reference `id`; storage and download security remain host responsibilities.
