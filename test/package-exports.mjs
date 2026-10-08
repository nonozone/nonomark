import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text', 'MutationObserver', 'DOMParser', 'SVGElement', 'getComputedStyle']) {
  const value = name === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[name];
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
const require = createRequire(import.meta.url);

for (const name of ['@nonoim/editor-core', '@nonoim/editor-vue', '@nonoim/editor-react', '@nonoim/editor']) {
  test(`${name}: built ESM and CommonJS exports`, async () => {
    const esm = await import(name), cjs = require(name);
    if (name === '@nonoim/editor-core') {
      for (const entry of [esm, cjs]) {
        assert.equal(entry.requiresSourceMode('<figure><img src="/photo.jpg" alt=""><figcaption>Caption</figcaption></figure>'), false);
        assert.equal(entry.requiresSourceMode('<div class="nono-image-gallery" data-nono-gallery="2"><figure><img src="/photo.jpg" alt=""><figcaption>Caption</figcaption></figure><img src="/second.jpg" alt=""></div>'), false);
      }
      return;
    }
    assert.ok(esm.NonoEditor);
    assert.ok(cjs.NonoEditor);
    for (const lazy of [await import(`${name}/lazy`), require(`${name}/lazy`)]) {
      const loaded = await lazy.preloadNonoEditor();
      assert.ok(loaded.NonoEditor || loaded.default);
    }
    assert.match(readFileSync(require.resolve(`${name}/style.css`), 'utf8'), /nono-rich-editor__image-properties/);
  });
}

const markdown = 'Before\n\n![First](/same.jpg "First title")\n![Second](/same.jpg "Second title")\n\nAfter';
const field = (host, label) => host.querySelector(`input[aria-label="${label}"]`);
const selectSecond = host => host.querySelectorAll('.nono-rich-editor__content img')[1].dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
const verifyImageEdit = host => {
  const images = Array.from(host.querySelectorAll('.nono-rich-editor__content img'));
  assert.deepEqual(images.map(image => image.alt), ['First', '']);
  assert.deepEqual(images.map(image => image.title), ['First title', 'Second title']);
  assert.equal(host.querySelector('figcaption').textContent, 'Caption');
  assert.equal(host.querySelector('.nono-image-gallery').dataset.nonoGallery, '2');
  const instance = host.querySelector('[contenteditable]').editor;
  assert.match(instance.getMarkdown(), /Before/);
  assert.match(instance.getMarkdown(), /After/);
  assert.match(instance.getMarkdown(), /data-nono-gallery="2"/);
  instance.state.doc.check();
};

test('built Vue CommonJS editor applies independent image fields', async () => {
  const { createApp, nextTick } = require('vue');
  const host = document.createElement('div'); document.body.append(host);
  const app = createApp(require('@nonoim/editor-vue').NonoEditor, { modelValue: markdown });
  try {
    app.mount(host); await nextTick(); await nextTick();
    assert.equal(host.querySelectorAll('.nono-rich-editor__content img').length, 2, host.innerHTML);
    selectSecond(host); await nextTick();
    host.querySelector('.nono-rich-editor__image-properties-button').click(); await nextTick();
    for (const [label, value] of [['Alternative text (alt)', ''], ['Caption (optional)', 'Caption']]) {
      const input = field(host, label); input.value = value; input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    await nextTick();
    host.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await nextTick(); verifyImageEdit(host);
  } finally { app.unmount(); host.remove(); }
});

test('built React CommonJS editor applies independent image fields', async () => {
  const React = require('react'), { createRoot } = require('react-dom/client');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await React.act(async () => root.render(React.createElement(require('@nonoim/editor-react').NonoEditor, { value: markdown })));
    await React.act(async () => selectSecond(host));
    await React.act(async () => host.querySelector('.nono-rich-editor__image-properties-button').click());
    for (const [label, value] of [['Alternative text (alt)', ''], ['Caption (optional)', 'Caption']]) {
      await React.act(async () => {
        const input = field(host, label);
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    }
    await React.act(async () => host.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    verifyImageEdit(host);
  } finally { await React.act(async () => root.unmount()); host.remove(); }
});
