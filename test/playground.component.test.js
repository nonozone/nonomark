import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from '../apps/playground/src/App.vue';
import { SNAPSHOTS_KEY, STORAGE_KEY, loadDocument, loadSnapshots, saveDocument } from '../apps/playground/src/storage.js';

let wrapper;

const findButton = (text) => wrapper.findAll('button').find((button) => button.text().includes(text));

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function showModal() { this.setAttribute('open', ''); }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: vi.fn(function close() { this.removeAttribute('open'); }),
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
  delete HTMLDialogElement.prototype.showModal;
  delete HTMLDialogElement.prototype.close;
  window.localStorage.clear();
});

describe('Playground content safety', () => {
  it('protects the current document before creating a blank one', async () => {
    saveDocument(window.localStorage, '# Keep me', 100);
    wrapper = mount(App);
    await nextTick();

    await findButton('新建 / 清空').trigger('click');
    await flushPromises();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(loadDocument(window.localStorage).content).toBe('');
    expect(loadSnapshots(window.localStorage)[0].content.trim()).toBe('# Keep me');
    expect(wrapper.text()).toContain('已保存');
  });

  it('imports Markdown after snapshotting the replaced content', async () => {
    saveDocument(window.localStorage, '# Before import', 100);
    wrapper = mount(App);
    await nextTick();
    const input = wrapper.find('input[type="file"][accept*=".md"]');
    const file = { name: 'imported.md', size: 12, text: vi.fn(async () => '# Imported') };
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });

    await input.trigger('change');
    await flushPromises();

    expect(file.text).toHaveBeenCalledOnce();
    expect(loadDocument(window.localStorage).content).toBe('# Imported');
    expect(loadSnapshots(window.localStorage)[0].content.trim()).toBe('# Before import');
  });

  it('downloads Markdown and restores a selected history version safely', async () => {
    saveDocument(window.localStorage, '# Current', 300);
    window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify([
      { content: '# Older version', updatedAt: 200 },
    ]));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nonomark');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { downloadName = this.download; });
    wrapper = mount(App);
    await nextTick();

    await findButton('导出 Markdown').trigger('click');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(downloadName).toMatch(/^nonoMark-\d{4}-\d{2}-\d{2}-\d{4}\.md$/);

    await findButton('恢复历史版本').trigger('click');
    const restore = wrapper.findAll('.recovery-list button').find((button) => button.text().includes('Older version'));
    await restore.trigger('click');
    await flushPromises();

    expect(loadDocument(window.localStorage).content).toBe('# Older version');
    expect(loadSnapshots(window.localStorage).some((snapshot) => snapshot.content.trim() === '# Current')).toBe(true);
  });

  it('makes a browser storage failure visible and recommends export', async () => {
    saveDocument(window.localStorage, '# At risk', 100);
    wrapper = mount(App);
    await nextTick();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await findButton('新建 / 清空').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('保存失败');
    expect(wrapper.text()).toContain('请立即导出 Markdown 备份');
  });
});
