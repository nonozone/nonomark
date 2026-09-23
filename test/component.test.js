import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NonoEditor from '../packages/vue/src/NonoEditor.vue';

const mounted = [];
const mountEditor = async (props = {}, options = {}) => {
  const wrapper = mount(NonoEditor, { ...options, props: { modelValue: '', ...props } });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
};

afterEach(() => {
  while (mounted.length) mounted.pop().unmount();
});

describe('NonoEditor integration', () => {
  it('inserts a two image gallery through the host picker callback', async () => {
    const wrapper = await mountEditor({ enableGallery: true });
    await wrapper.find('button[title="Gallery"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    const pickerButtons = wrapper.findAll('button').filter((button) => button.text().includes('Choose image'));
    await pickerButtons[0].trigger('click');
    const firstPick = wrapper.emitted('gallery-pick-image').at(-1)[0];
    firstPick.onSelect({ url: 'https://example.com/one.jpg', alt: 'One' });
    await pickerButtons[1].trigger('click');
    const secondPick = wrapper.emitted('gallery-pick-image').at(-1)[0];
    secondPick.onSelect({ url: 'https://example.com/two.jpg', alt: 'Two' });

    const captions = wrapper.findAll('input').filter((input) => input.attributes('placeholder')?.includes('caption'));
    await captions[0].setValue('First image');
    await captions[1].setValue('Second image');
    await wrapper.findAll('button').find((button) => button.text().includes('Insert into document')).trigger('click');

    const value = wrapper.emitted('update:modelValue').at(-1)[0];
    expect(value).toContain('![First image](https://example.com/one.jpg)\n![Second image](https://example.com/two.jpg)');
    expect(value).not.toContain('|');
  });

  it('round trips consecutive Markdown image lines in visual mode', async () => {
    const markdown = '![Workshop](https://example.com/a.jpg)\n![Machine](https://example.com/b.jpg)';
    const wrapper = await mountEditor({ modelValue: markdown });
    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.findAll('.nono-rich-editor__content img:not(.ProseMirror-separator)')).toHaveLength(2);
    await wrapper.findAll('button').find((button) => button.text().includes('Source')).trigger('click');
    expect(wrapper.find('textarea.nono-rich-editor__source').element.value).toContain('![Workshop](https://example.com/a.jpg)');
    expect(wrapper.find('textarea.nono-rich-editor__source').element.value).toContain('![Machine](https://example.com/b.jpg)');
  });
  it('keeps convertible pasted HTML in visual mode by default', async () => {
    const wrapper = await mountEditor({ modelValue: '<p>Hello <strong>world</strong></p><p>Next line<br>here</p>' });
    expect(wrapper.find('[contenteditable]').exists()).toBe(true);
    expect(wrapper.find('textarea.nono-rich-editor__source').exists()).toBe(false);
  });
  it('honors readonly and disabled in both editor modes', async () => {
    const readonlyEditor = await mountEditor({ modelValue: '**read only**', readonly: true });
    expect(readonlyEditor.find('[contenteditable]').attributes('contenteditable')).toBe('false');

    const disabledEditor = await mountEditor({ modelValue: '- [ ] protected', autoSourceMode: true, disabled: true });
    expect(disabledEditor.find('textarea.nono-rich-editor__source').attributes()).toHaveProperty('disabled');
  });

  it('opens an inline link editor instead of a browser prompt', async () => {
    const wrapper = await mountEditor({ modelValue: 'link me' });
    const linkButton = wrapper.findAll('button').find((button) => button.text().includes('Link'));
    await linkButton.trigger('click');
    expect(wrapper.find('input[aria-label="Link URL"]').exists()).toBe(true);
  });

  it('locks image input while an upload is running', async () => {
    let finishUpload;
    let uploadContext;
    const uploadImages = vi.fn((_files, context) => {
      uploadContext = context;
      return new Promise((resolve) => { finishUpload = resolve; });
    });
    const wrapper = await mountEditor({ uploadImages });
    const input = wrapper.find('input[type="file"]');
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });

    await input.trigger('change');
    expect(input.attributes()).toHaveProperty('disabled');
    expect(uploadImages).toHaveBeenCalledTimes(1);
    expect(typeof uploadContext).toBe('function');
    expect(uploadContext.onProgress).toBe(uploadContext);
    expect(uploadContext.signal).toBeInstanceOf(AbortSignal);

    finishUpload([{ url: 'https://example.com/photo.png', alt: 'photo' }]);
    await flushPromises();
  });

  it('cancels an active upload through the standard AbortSignal', async () => {
    let receivedSignal;
    const uploadImages = vi.fn((_files, { signal }) => new Promise((_resolve, reject) => {
      receivedSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    }));
    const wrapper = await mountEditor({ uploadImages });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['image'], 'photo.png', { type: 'image/png' })],
    });

    await input.trigger('change');
    await wrapper.find('button[title="Cancel upload"]').trigger('click');
    await flushPromises();

    expect(receivedSignal.aborted).toBe(true);
    expect(wrapper.emitted('upload-cancel')).toHaveLength(1);
    expect(wrapper.text()).toContain('Cancelled');
  });

  it('routes pasted images through the host upload function', async () => {
    const uploadImages = vi.fn(async () => [{ url: 'https://example.com/pasted.png', alt: 'pasted' }]);
    const wrapper = await mountEditor({ uploadImages });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [new File(['image'], 'pasted.png', { type: 'image/png' })],
        getData: () => '',
      },
    });

    wrapper.find('[contenteditable]').element.dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
    expect(uploadImages).toHaveBeenCalledTimes(1);
  });

  it('imports remote Markdown images from the current visual paste only', async () => {
    let receivedContext;
    const importRemoteImages = vi.fn(async (images, context) => {
      receivedContext = context;
      return [{ id: images[0].id, url: 'https://cdn.example/imported.jpg' }];
    });
    const wrapper = await mountEditor({ importRemoteImages });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: {
      files: [],
      getData: (type) => type === 'text/plain' ? '![Cover](https://origin.example/cover.jpg "Title")' : '',
    } });

    wrapper.find('[contenteditable]').element.dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
    expect(importRemoteImages).toHaveBeenCalledWith([
      expect.objectContaining({ url: 'https://origin.example/cover.jpg', alt: 'Cover', title: 'Title' }),
    ], expect.any(Function));
    expect(receivedContext.signal).toBeInstanceOf(AbortSignal);
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toContain('https://cdn.example/imported.jpg');
    expect(wrapper.emitted('remote-image-import-complete')).toHaveLength(1);
  });

  it('imports remote images at the current source selection', async () => {
    const importRemoteImages = vi.fn(async (images) => [{ id: images[0].id, url: 'https://cdn.example/source.jpg' }]);
    const wrapper = await mountEditor({ modelValue: '- [ ] protected\n', autoSourceMode: true, importRemoteImages });
    const source = wrapper.find('textarea.nono-rich-editor__source');
    source.element.setSelectionRange(source.element.value.length, source.element.value.length);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: {
      files: [],
      getData: (type) => type === 'text/plain' ? '![Source](https://origin.example/source.jpg)' : '',
    } });

    source.element.dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([
      '- [ ] protected\n![Source](https://cdn.example/source.jpg)',
    ]);
  });

  it('renders embedded images only when explicitly enabled', async () => {
    const source = '![pixel](data:image/png;base64,iVBORw0KGgo=)';
    const wrapper = await mountEditor({ modelValue: source, allowBase64Images: true });
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('selects an image by mouse and deletes the selected node', async () => {
    const wrapper = await mountEditor({ modelValue: 'Before\n\n![photo](https://example.com/photo.jpg)\n\nAfter' });
    const image = wrapper.find('.nono-rich-editor__content img');

    await image.trigger('mousedown', { clientX: 10, clientY: 10, button: 0 });
    await nextTick();

    expect(image.classes()).toContain('ProseMirror-selectednode');
    await wrapper.find('[contenteditable]').trigger('keydown', { key: 'Delete', code: 'Delete' });
    await nextTick();
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).not.toContain('photo.jpg');
  });

  it('keeps formatting tools usable in Markdown source mode', async () => {
    const wrapper = await mountEditor({ modelValue: '- [ ] protected', autoSourceMode: true });
    const source = wrapper.find('textarea.nono-rich-editor__source');
    source.element.setSelectionRange(6, 15);

    await wrapper.find('button[title="Bold"]').trigger('click');

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['- [ ] **protected**']);
    expect(wrapper.find('button[title="Italic"]').exists()).toBe(true);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });

  it('provides unobtrusive host slots for document tools and save state', async () => {
    const wrapper = await mountEditor({}, {
      slots: {
        'toolbar-end': '<button class="host-file-menu">文件</button>',
        'footer-status': '<span class="host-save-state">已保存</span>',
      },
    });

    expect(wrapper.find('.nono-rich-editor__toolbar .host-file-menu').text()).toBe('文件');
    expect(wrapper.find('.nono-rich-editor__footer .host-save-state').text()).toBe('已保存');
  });
});
