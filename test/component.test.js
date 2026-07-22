import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NonoEditor from '../src/NonoEditor.vue';

const mounted = [];
const mountEditor = async (props = {}) => {
  const wrapper = mount(NonoEditor, { props: { modelValue: '', ...props } });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
};

afterEach(() => {
  while (mounted.length) mounted.pop().unmount();
});

describe('NonoEditor integration', () => {
  it('honors readonly and disabled in both editor modes', async () => {
    const readonlyEditor = await mountEditor({ modelValue: '**read only**', readonly: true });
    expect(readonlyEditor.find('[contenteditable]').attributes('contenteditable')).toBe('false');

    const disabledEditor = await mountEditor({ modelValue: '- [ ] protected', disabled: true });
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
    const uploadImages = vi.fn(() => new Promise((resolve) => { finishUpload = resolve; }));
    const wrapper = await mountEditor({ uploadImages });
    const input = wrapper.find('input[type="file"]');
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });

    await input.trigger('change');
    expect(input.attributes()).toHaveProperty('disabled');
    expect(uploadImages).toHaveBeenCalledTimes(1);

    finishUpload([{ url: 'https://example.com/photo.png', alt: 'photo' }]);
    await flushPromises();
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

  it('renders embedded images only when explicitly enabled', async () => {
    const source = '![pixel](data:image/png;base64,iVBORw0KGgo=)';
    const wrapper = await mountEditor({ modelValue: source, allowBase64Images: true });
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('keeps formatting tools usable in Markdown source mode', async () => {
    const wrapper = await mountEditor({ modelValue: '- [ ] protected' });
    const source = wrapper.find('textarea.nono-rich-editor__source');
    source.element.setSelectionRange(6, 15);

    await wrapper.find('button[title="Bold"]').trigger('click');

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['- [ ] **protected**']);
    expect(wrapper.find('button[title="Italic"]').exists()).toBe(true);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
});
