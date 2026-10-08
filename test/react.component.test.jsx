import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NonoEditor } from '../packages/react/src/index.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots = [];

const renderEditor = async (props = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  await act(async () => { root.render(<NonoEditor value="" {...props} />); });
  return container;
};

afterEach(async () => {
  while (roots.length) {
    const { root, container } = roots.pop();
    await act(async () => root.unmount());
    container.remove();
  }
});

describe('React NonoEditor', () => {
  it('protects unsupported Markdown in source mode and keeps formatting available', async () => {
    const onChange = vi.fn();
    const container = await renderEditor({ value: '- [ ] protected', autoSourceMode: true, onChange, locale: 'zh' });
    const source = container.querySelector('textarea.nono-rich-editor__source');
    expect(source).not.toBeNull();
    source.setSelectionRange(6, 15);
    await act(async () => container.querySelector('button[title="粗体"]').click());
    expect(onChange).toHaveBeenLastCalledWith('- [ ] **protected**');
  });

  it('honors readonly and exposes host extension points', async () => {
    const container = await renderEditor({
      value: '**read only**',
      readOnly: true,
      toolbarEnd: <button className="host-action">File</button>,
      footerStatus: <span className="host-status">Saved</span>,
    });
    expect(container.querySelector('[contenteditable]')?.getAttribute('contenteditable')).toBe('false');
    expect(container.querySelector('.host-action')?.textContent).toBe('File');
    expect(container.querySelector('.host-status')?.textContent).toBe('Saved');
  });

  it('uses the standard upload context and inserts returned images', async () => {
    let context;
    const uploadImages = vi.fn(async (_files, value) => {
      context = value;
      return [{ url: 'https://example.com/image.png', alt: 'image' }];
    });
    const onUploadComplete = vi.fn();
    const container = await renderEditor({ uploadImages, onUploadComplete });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'image.png', { type: 'image/png' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(typeof context).toBe('function');
    expect(context.signal).toBeInstanceOf(AbortSignal);
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('selects an image by mouse and deletes the selected node', async () => {
    const onChange = vi.fn();
    const container = await renderEditor({ value: 'Before\n\n![photo](https://example.com/photo.jpg)\n\nAfter', onChange });
    const image = container.querySelector('.nono-rich-editor__content img');
    const emptyRect = { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => emptyRect });

    await act(async () => image.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })));
    expect(image.classList.contains('ProseMirror-selectednode')).toBe(true);

    await act(async () => container.querySelector('[contenteditable]').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' })));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining('photo.jpg'));
  });

  it('keeps image drafts and occurrence attributes independent through undo and save/reopen', async () => {
    const onChange = vi.fn();
    const container = await renderEditor({ value: '![One](/same.jpg "First title")\n![Two](/same.jpg "Second title")', onChange, locale: 'zh-CN' });
    const click = element => act(async () => element.click());
    const field = label => container.querySelector(`input[aria-label="${label}"]`);
    const fill = async (element, value) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const open = async () => {
      await act(async () => container.querySelectorAll('.nono-rich-editor__content img')[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })));
      await click(container.querySelector('.nono-rich-editor__image-properties-button'));
    };
    const button = text => Array.from(container.querySelectorAll('.nono-rich-editor__image-properties button')).find(element => element.textContent === text);
    const submit = () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const instance = container.querySelector('[contenteditable]').editor;
    await open();
    expect(field('锚文本 alt').value).toBe('Two');
    await fill(field('图片说明（可选）'), 'Visible caption');
    expect(field('锚文本 alt').value).toBe('Two');
    await act(async () => field('锚文本 alt').focus());
    expect(field('图片说明（可选）').value).toBe('Visible caption');
    await click(button('一键替换ALT'));
    expect(field('锚文本 alt').value).toBe('Visible caption');
    await click(button('取消'));
    expect(container.querySelector('figcaption')).toBeNull();
    await open();
    await fill(field('锚文本 alt'), 'Esc draft');
    await act(async () => field('锚文本 alt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('form')).toBeNull();
    await open();
    expect(field('锚文本 alt').value).toBe('Two');
    await fill(field('锚文本 alt'), '');
    await fill(field('图片说明（可选）'), 'Visible caption');
    await submit();
    expect(Array.from(container.querySelectorAll('.nono-rich-editor__content img')).map(image => image.alt)).toEqual(['One', '']);
    expect(container.querySelector('figcaption').textContent).toBe('Visible caption');
    await act(async () => instance.commands.undo());
    expect(container.querySelectorAll('.nono-rich-editor__content img')[1].alt).toBe('Two');
    expect(container.querySelector('figcaption')).toBeNull();
    await act(async () => instance.commands.redo());
    const saved = onChange.mock.lastCall[0];
    const reopened = await renderEditor({ value: saved, autoSourceMode: true });
    expect(reopened.querySelector('[contenteditable]')).not.toBeNull();
    expect(reopened.querySelectorAll('.nono-rich-editor__content img')[1].alt).toBe('');
    expect(reopened.querySelectorAll('.nono-rich-editor__content img')[1].title).toBe('Second title');
    const sourceButton = () => Array.from(reopened.querySelectorAll('button')).find(element => /Source|Visual/.test(element.textContent));
    await click(sourceButton());
    await click(sourceButton());
    expect(reopened.querySelector('figcaption').textContent).toBe('Visible caption');
    expect(reopened.querySelectorAll('.nono-rich-editor__content img')[1].alt).toBe('');
  });

  it('imports remote Markdown images from a visual paste', async () => {
    const onChange = vi.fn();
    const onRemoteImageImportComplete = vi.fn();
    const importRemoteImages = vi.fn(async (images) => [
      { id: images[0].id, url: 'https://cdn.example/react.jpg' },
    ]);
    const container = await renderEditor({ importRemoteImages, onChange, onRemoteImageImportComplete });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: {
      files: [],
      getData: (type) => type === 'text/plain' ? '![React](https://origin.example/react.jpg)' : '',
    } });

    await act(async () => container.querySelector('[contenteditable]').dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(importRemoteImages).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('https://cdn.example/react.jpg'));
    expect(onRemoteImageImportComplete).toHaveBeenCalledTimes(1);
  });

  it('imports remote Markdown images in source mode', async () => {
    const onChange = vi.fn();
    const importRemoteImages = vi.fn(async (images) => [
      { id: images[0].id, url: 'https://cdn.example/source.jpg' },
    ]);
    const container = await renderEditor({ value: '- [ ] protected\n', autoSourceMode: true, importRemoteImages, onChange });
    const source = container.querySelector('textarea.nono-rich-editor__source');
    source.setSelectionRange(source.value.length, source.value.length);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: {
      files: [],
      getData: (type) => type === 'text/plain' ? '![Source](https://origin.example/source.jpg)' : '',
    } });

    await act(async () => source.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith('- [ ] protected\n![Source](https://cdn.example/source.jpg)');
  });
});
