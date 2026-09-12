import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { NonoLazyEditor, preloadNonoEditor } from '../packages/vue/src/lazy.js';

const mounted = [];

afterEach(() => {
  while (mounted.length) mounted.pop().unmount();
});

describe('Vue lazy editor', () => {
  it('provides an editable Markdown fallback before the full editor resolves', async () => {
    const wrapper = mount(NonoLazyEditor, {
      props: { modelValue: '# Available immediately', placeholder: 'Write Markdown' },
    });
    mounted.push(wrapper);

    const fallback = wrapper.find('textarea.nono-rich-editor__lazy-fallback');
    expect(fallback.exists()).toBe(true);
    expect(fallback.element.value).toBe('# Available immediately');

    await fallback.setValue('# Edited while loading');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['# Edited while loading']);

    await preloadNonoEditor();
    await flushPromises();
    expect(wrapper.find('[contenteditable]').exists()).toBe(true);
  });

  it('reuses one preload request', () => {
    expect(preloadNonoEditor()).toBe(preloadNonoEditor());
  });
});
