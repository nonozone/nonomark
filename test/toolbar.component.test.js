// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import NonoVueEditor from '../packages/vue/src/NonoEditor.vue';
import { NonoEditor as NonoReactEditor } from '../packages/react/src/index.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vueWrappers = [];
const reactRoots = [];

const mountVue = async props => {
  const wrapper = mount(NonoVueEditor, { props: { modelValue: '', locale: 'zh-CN', ...props } });
  vueWrappers.push(wrapper);
  await nextTick();
  return wrapper;
};

const mountReact = async props => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  reactRoots.push({ root, container });
  await act(async () => root.render(React.createElement(NonoReactEditor, { value: '', locale: 'zh-CN', ...props })));
  return container;
};

afterEach(async () => {
  while (vueWrappers.length) vueWrappers.pop().unmount();
  while (reactRoots.length) {
    const { root, container } = reactRoots.pop();
    await act(async () => root.unmount());
    container.remove();
  }
});

const longText = 'Long article before target text after the selected words.';

describe('responsive formatting toolbar', () => {
  it('Vue keeps the long-text selection through more and applies bold only to the target', async () => {
    const wrapper = await mountVue({ modelValue: longText });
    const editor = wrapper.find('[contenteditable]').element.editor;
    const start = 1 + longText.indexOf('target');
    editor.commands.setTextSelection({ from: start, to: start + 'target'.length });

    const toolbar = wrapper.find('.nono-rich-editor__toolbar');
    const more = wrapper.find('.nono-rich-editor__toolbar-more');
    expect(more.attributes('aria-label')).toBe('更多工具');
    expect(more.attributes('aria-expanded')).toBe('false');
    await more.trigger('click');
    expect(toolbar.classes()).toContain('is-expanded');
    expect(more.attributes('aria-expanded')).toBe('true');
    await wrapper.find('button[title="粗体"]').trigger('click');
    expect(editor.getMarkdown()).toBe('Long article before **target** text after the selected words.');

    await more.trigger('click');
    expect(toolbar.classes()).not.toContain('is-expanded');
    expect(more.attributes('aria-expanded')).toBe('false');
  });

  it('Vue preserves an uncommitted source draft while toggling more and closing with Escape', async () => {
    const wrapper = await mountVue({ modelValue: '- [ ] protected', autoSourceMode: true });
    const source = wrapper.find('textarea.nono-rich-editor__source');
    const draft = '- [ ] protected\nunsaved draft';
    await source.setValue(draft);
    const toolbar = wrapper.find('.nono-rich-editor__toolbar');
    const more = wrapper.find('.nono-rich-editor__toolbar-more');
    await more.trigger('click');
    expect(toolbar.classes()).toContain('is-expanded');
    await toolbar.trigger('keydown', { key: 'Escape' });
    expect(toolbar.classes()).not.toContain('is-expanded');
    expect(wrapper.find('textarea.nono-rich-editor__source').element.value).toBe(draft);
  });

  it('React keeps the long-text selection through more and applies bold only to the target', async () => {
    const onChange = vi.fn();
    const container = await mountReact({ value: longText, onChange });
    const editor = container.querySelector('[contenteditable]').editor;
    const start = 1 + longText.indexOf('target');
    await act(async () => editor.commands.setTextSelection({ from: start, to: start + 'target'.length }));

    const toolbar = container.querySelector('.nono-rich-editor__toolbar');
    const more = container.querySelector('.nono-rich-editor__toolbar-more');
    expect(more.getAttribute('aria-label')).toBe('更多工具');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await act(async () => more.click());
    expect(toolbar.classList.contains('is-expanded')).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    await act(async () => container.querySelector('button[title="粗体"]').click());
    expect(onChange).toHaveBeenLastCalledWith('Long article before **target** text after the selected words.');

    await act(async () => more.click());
    expect(toolbar.classList.contains('is-expanded')).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('React preserves an uncommitted source draft while toggling more and closing with Escape', async () => {
    const container = await mountReact({ value: '- [ ] protected', autoSourceMode: true });
    const source = container.querySelector('textarea.nono-rich-editor__source');
    const draft = '- [ ] protected\nunsaved draft';
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      valueSetter.call(source, draft);
      source.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const toolbar = container.querySelector('.nono-rich-editor__toolbar');
    const more = container.querySelector('.nono-rich-editor__toolbar-more');
    await act(async () => more.click());
    expect(toolbar.classList.contains('is-expanded')).toBe(true);
    await act(async () => toolbar.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(toolbar.classList.contains('is-expanded')).toBe(false);
    expect(container.querySelector('textarea.nono-rich-editor__source').value).toBe(draft);
  });
});
