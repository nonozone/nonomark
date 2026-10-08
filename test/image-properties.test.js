import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { CaptionImage, imageMarkdown, requiresImageSourceMode } from '../packages/vue/src/imageProperties.js';
import { buildGalleryMarkdown } from '../packages/vue/src/gallery.js';

const createEditor = content => new Editor({ extensions: [StarterKit, CaptionImage, TableKit, Markdown], content, contentType: 'markdown' });

describe('portable image attributes', () => {
  it('keeps empty alt and independent captions through save and reopen', () => {
    const attrs = { src: 'https://example.com/a.jpg?x=1&y=2', alt: '', title: 'Original "title"', caption: 'A < B & "C"' };
    const markdown = imageMarkdown(attrs);
    expect(markdown).toContain('alt=""');
    const first = createEditor(markdown);
    const image = first.getJSON().content[0];
    expect(image.type).toBe('image');
    expect(image.attrs).toMatchObject(attrs);
    const second = createEditor(first.getMarkdown());
    expect(second.getJSON()).toEqual(first.getJSON());
    expect(second.getHTML()).toContain('<figcaption>A &lt; B &amp; "C"</figcaption>');
    first.destroy(); second.destroy();
  });

  it('keeps plain images in Markdown and escapes descriptions and titles', () => {
    const attrs = { src: 'https://example.com/a.jpg', alt: 'A [cat] \\ dog', title: 'A "title"' };
    const markdown = imageMarkdown(attrs);
    expect(markdown.startsWith('![')).toBe(true);
    const editor = createEditor(markdown);
    expect(editor.getJSON().content[0].attrs).toMatchObject(attrs);
    editor.destroy();
    expect(imageMarkdown({ src: attrs.src, alt: '' })).toBe('![](https://example.com/a.jpg)');
  });

  it('allows generated figures in visual mode and protects unsupported HTML', () => {
    expect(requiresImageSourceMode(imageMarkdown({ src: '/photo.jpg', alt: 'Default', caption: 'Caption' }))).toBe(false);
    expect(requiresImageSourceMode('<figure class="custom"><img src="/photo.jpg"><figcaption><b>Caption</b></figcaption></figure>')).toBe(true);
    expect(requiresImageSourceMode('<script>alert(1)</script>')).toBe(true);
  });

  it('preserves surrounding article text and valid block images through repeated saves', () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 段：长文章正文。`);
    const content = '# 标题\n\n' + paragraphs.join('\n\n') + '\n\n![One](/one.jpg)\n![Two](/two.jpg)\n\n结尾。';
    const editor = createEditor(content);
    expect(() => editor.state.doc.check()).not.toThrow();
    for (const paragraph of paragraphs) expect(editor.getText()).toContain(paragraph);
    const reopened = createEditor(editor.getMarkdown());
    expect(reopened.getJSON()).toEqual(editor.getJSON());
    editor.destroy(); reopened.destroy();
  });

  it('retains paragraph formatting, lists and tables with the image extension', () => {
    for (const content of [
      'Before **bold** and _italic_ [link](/link) `code`.\n\n![alt](/a.jpg)\n\nAfter.',
      '- Item\n  - Nested\n\n1. First\n2. Second',
      '> Quote\n\n```js\nconst value = 1;\n```',
      '| A | B |\n| --- | --- |\n| One | Two |',
    ]) {
      const editor = createEditor(content), reopened = createEditor(editor.getMarkdown());
      expect(reopened.getJSON()).toEqual(editor.getJSON());
      editor.destroy(); reopened.destroy();
    }
  });

  it('keeps gallery defaults separate from visible captions and permits empty alt', () => {
    const markdown = buildGalleryMarkdown([
      { url: '/one.jpg', alt: 'Library default', title: 'Keep', caption: 'Visible caption' },
      { url: '/two.jpg', alt: '', caption: '' },
    ]);
    const editor = createEditor(markdown);
    const images = [];
    editor.state.doc.descendants(node => { if (node.type.name === 'image') images.push(node.toJSON()); });
    expect(images.map(node => node.attrs.alt)).toEqual(['Library default', '']);
    expect(images.map(node => node.attrs.caption)).toEqual(['Visible caption', null]);
    expect(images[0].attrs.title).toBe('Keep');
    editor.destroy();
  });
});
