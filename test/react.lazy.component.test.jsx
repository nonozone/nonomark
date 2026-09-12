import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NonoLazyEditor, preloadNonoEditor } from '../packages/react/src/lazy.jsx';

describe('React lazy editor', () => {
  it('renders an editable Markdown fallback while the full editor loads', () => {
    const html = renderToString(<NonoLazyEditor value="# Available immediately" placeholder="Write Markdown" />);
    expect(html).toContain('nono-rich-editor__lazy-fallback');
    expect(html).toContain('# Available immediately');
    expect(html).not.toContain('contenteditable="true"');
  });

  it('reuses one preload request', () => {
    expect(preloadNonoEditor()).toBe(preloadNonoEditor());
  });
});
