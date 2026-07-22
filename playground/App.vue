<template>
  <main class="playground-shell">
    <section class="editor-stage" aria-label="nonoMark 在线编辑器">
      <NonoEditor
        v-model="markdown"
        locale="zh-CN"
        placeholder="开始写作…"
        fill
        autofocus
        allow-base64-images
        image-accept="image/jpeg,image/png,image/webp,image/gif"
        :max-image-size="1024 * 1024"
        :upload-images="uploadImages"
      />
    </section>
    <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>
  </main>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { NonoEditor } from '../src/index.js';
import { embedImages } from './images.js';
import { loadDocument, saveDocument } from './storage.js';

const initialDocument = loadDocument(window.localStorage);
const markdown = ref(initialDocument.content);
const saveError = ref('');
let saveTimer;

const saveNow = () => {
  clearTimeout(saveTimer);
  try {
    saveDocument(window.localStorage, markdown.value);
    saveError.value = '';
  } catch (error) {
    saveError.value = `浏览器无法保存内容：${error?.message || String(error)}`;
  }
};

watch(markdown, () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 450);
});

const uploadImages = (files, onProgress) => embedImages(files, onProgress);

onBeforeUnmount(() => clearTimeout(saveTimer));
</script>
