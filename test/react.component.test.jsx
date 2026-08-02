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
    const container = await renderEditor({ value: '- [ ] protected', onChange, locale: 'zh' });
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
    const container = await renderEditor({ value: '- [ ] protected\n', importRemoteImages, onChange });
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
