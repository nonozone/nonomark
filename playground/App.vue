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
      >
        <template #toolbar-end>
          <div class="nono-rich-editor__group playground-file-group">
            <details ref="fileMenu" class="playground-file-menu">
              <summary class="nono-rich-editor__button" title="文档操作">☰ <span>文件</span>⌄</summary>
              <div class="playground-file-panel" role="menu" aria-label="文档操作">
                <label class="playground-file-action">
                  <span>↑</span><span>导入 Markdown</span>
                  <input ref="importInput" type="file" accept=".md,.markdown,text/markdown" @change="importMarkdown">
                </label>
                <button type="button" class="playground-file-action" @click="exportMarkdown"><span>↓</span><span>导出 Markdown</span></button>
                <button type="button" class="playground-file-action" :disabled="!snapshots.length" @click="openRecovery">
                  <span>↶</span><span>恢复历史版本</span><small v-if="snapshots.length">{{ snapshots.length }}</small>
                </button>
                <div class="playground-file-divider"></div>
                <button type="button" class="playground-file-action is-danger" :disabled="!markdown" @click="newDocument"><span>＋</span><span>新建 / 清空</span></button>
              </div>
            </details>
          </div>
        </template>

        <template #footer-status>
          <span class="playground-save-state" :class="`is-${saveState}`" :title="saveStatusTitle" aria-live="polite">
            <i></i>{{ saveStatusText }}
          </span>
        </template>
      </NonoEditor>
    </section>

    <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>

    <dialog ref="recoveryDialog" class="recovery-dialog" aria-labelledby="recovery-title" @click.self="closeRecovery">
      <header>
        <div><strong id="recovery-title">历史版本</strong><span>自动保留最近 {{ snapshots.length }} 个版本</span></div>
        <button type="button" aria-label="关闭历史版本" @click="closeRecovery">×</button>
      </header>
      <div class="recovery-list">
        <button
          v-for="snapshot in snapshots"
          :key="snapshot.updatedAt"
          type="button"
          :disabled="snapshot.content === markdown"
          @click="restoreSnapshot(snapshot)"
        >
          <span><time :datetime="new Date(snapshot.updatedAt).toISOString()">{{ formatTime(snapshot.updatedAt) }}</time><small>{{ snapshot.content.length }} 个字符</small></span>
          <p>{{ snapshotSummary(snapshot.content) }}</p>
          <em>{{ snapshot.content === markdown ? '当前内容' : '恢复' }}</em>
        </button>
      </div>
      <p class="recovery-help">恢复前会先保存当前内容，因此仍可撤回。</p>
    </dialog>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NonoEditor, createLocalImageUploader } from '../src/index.js';
import { createMarkdownExport, readMarkdownFile } from './files.js';
import {
  getStorageHealth,
  loadDocument,
  loadSnapshots,
  saveDocument,
  saveSnapshot,
  shouldCreateSnapshot,
} from './storage.js';

const storage = window.localStorage;
const initialDocument = loadDocument(storage);
const markdown = ref(initialDocument.content);
const snapshots = ref(loadSnapshots(storage));
const saveState = ref(initialDocument.updatedAt ? 'saved' : 'idle');
const savedAt = ref(initialDocument.updatedAt);
const saveError = ref('');
const storageWarning = ref('');
const fileMenu = ref(null);
const importInput = ref(null);
const recoveryDialog = ref(null);
let saveTimer;

const formatTime = (value) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(value));

const saveStatusText = computed(() => {
  if (saveState.value === 'saving') return '保存中…';
  if (saveState.value === 'error') return '保存失败';
  if (saveState.value === 'warning') return '已保存 · 空间偏高';
  if (saveState.value === 'saved' && savedAt.value) return `已保存 ${formatTime(savedAt.value).slice(-8, -3)}`;
  return '本地自动保存';
});
const saveStatusTitle = computed(() => storageWarning.value || saveError.value || '内容仅保存在当前浏览器');

const updateStorageWarning = () => {
  const health = getStorageHealth(storage, markdown.value);
  if (health.level === 'ok') {
    storageWarning.value = '';
    return health;
  }
  const percent = Math.min(100, Math.round(health.ratio * 100));
  storageWarning.value = `浏览器存储预计已使用 ${percent}%，建议立即导出 Markdown 备份。`;
  return health;
};

const refreshSnapshots = () => { snapshots.value = loadSnapshots(storage); };

const saveNow = ({ createSnapshot = true } = {}) => {
  clearTimeout(saveTimer);
  saveState.value = 'saving';
  const now = Date.now();
  try {
    let health = updateStorageWarning();
    const saved = saveDocument(storage, markdown.value, now);
    savedAt.value = saved.updatedAt;
    saveError.value = '';

    if (createSnapshot && shouldCreateSnapshot(snapshots.value, markdown.value, now)) {
      try {
        snapshots.value = saveSnapshot(storage, markdown.value, now);
      } catch {
        storageWarning.value = '正文已保存，但历史版本空间不足。建议立即导出 Markdown 备份。';
      }
    }

    health = updateStorageWarning();
    saveState.value = health.level === 'ok' && !storageWarning.value ? 'saved' : 'warning';
    return true;
  } catch (error) {
    saveState.value = 'error';
    saveError.value = `浏览器无法保存内容：${error?.message || String(error)}。请立即导出 Markdown 备份。`;
    return false;
  }
};

const protectCurrentDocument = () => {
  if (!markdown.value) return;
  saveNow({ createSnapshot: false });
  try {
    snapshots.value = saveSnapshot(storage, markdown.value, Date.now());
  } catch {
    storageWarning.value = '当前正文已保存，但无法创建额外历史版本。';
    saveState.value = 'warning';
  }
};

const closeFileMenu = () => { if (fileMenu.value) fileMenu.value.open = false; };

const importMarkdown = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const content = await readMarkdownFile(file);
    if (markdown.value && !window.confirm(`导入“${file.name}”会替换当前内容，是否继续？\n当前内容会先保存到历史版本。`)) return;
    protectCurrentDocument();
    markdown.value = content;
    await nextTick();
    saveNow({ createSnapshot: false });
    closeFileMenu();
  } catch (error) {
    saveState.value = 'error';
    saveError.value = `无法导入文件：${error?.message || String(error)}`;
  }
};

const exportMarkdown = () => {
  saveNow();
  const { blob, filename } = createMarkdownExport(markdown.value);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  closeFileMenu();
};

const newDocument = () => {
  if (!markdown.value) return;
  if (!window.confirm('确定新建空白文档吗？\n当前内容会先保存到历史版本。')) return;
  protectCurrentDocument();
  markdown.value = '';
  nextTick(() => saveNow({ createSnapshot: false }));
  closeFileMenu();
};

const openRecovery = () => {
  refreshSnapshots();
  closeFileMenu();
  if (snapshots.value.length) recoveryDialog.value?.showModal();
};
const closeRecovery = () => recoveryDialog.value?.close();
const restoreSnapshot = (snapshot) => {
  if (snapshot.content === markdown.value) return;
  if (!window.confirm('恢复这个历史版本并替换当前内容吗？\n当前内容会先保存为新的历史版本。')) return;
  protectCurrentDocument();
  markdown.value = snapshot.content;
  nextTick(() => saveNow({ createSnapshot: false }));
  closeRecovery();
};

const snapshotSummary = (content) => content.replace(/data:image\/[^;]+;base64,[^)\s]+/gi, '[嵌入图片]').replace(/\s+/g, ' ').trim().slice(0, 90) || '空白内容';
const uploadImages = createLocalImageUploader();
const handlePageHide = () => saveNow({ createSnapshot: false });

watch(markdown, () => {
  saveState.value = 'saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 450);
});

onMounted(() => {
  updateStorageWarning();
  window.addEventListener('pagehide', handlePageHide);
});
onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  window.removeEventListener('pagehide', handlePageHide);
  saveNow({ createSnapshot: false });
});
</script>
