// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { NodeSelection } from 'prosemirror-state';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { buildGalleryMarkdown } from '../packages/vue/src/gallery.js';
import { CaptionImage, requiresImageSourceMode } from '../packages/vue/src/imageProperties.js';

const createEditor = content => new Editor({
  extensions: [StarterKit, CaptionImage, TableKit, Markdown],
  content,
  contentType: 'markdown',
});

const galleryNodes = editor => editor.state.doc.content.content.filter(node => node.type.name === 'imageGallery');

describe('image gallery Markdown groups', () => {
  it.each([2, 3, 4])('parses %i consecutive image rows as one gallery and emits single newlines', count => {
    const source = Array.from({ length: count }, (_, index) => `![Alt ${index + 1}](/image-${index + 1}.jpg)`).join('\n');
    const editor = createEditor(source);

    expect(galleryNodes(editor)).toHaveLength(1);
    expect(editor.getMarkdown()).toBe(source);
    expect(editor.getMarkdown()).not.toContain('\n\n');
    editor.destroy();
  });

  it('keeps blank-line-separated images out of the same gallery', () => {
    const editor = createEditor('![One](/one.jpg)\n\n![Two](/two.jpg)');

    expect(galleryNodes(editor)).toHaveLength(0);
    expect(editor.state.doc.content.content.filter(node => node.type.name === 'image')).toHaveLength(2);
    expect(editor.getMarkdown()).toBe('![One](/one.jpg)\n\n![Two](/two.jpg)');
    editor.destroy();
  });

  it('preserves multiple groups and surrounding text over repeated round trips', () => {
    const source = [
      'Before.',
      '',
      '![One](/one.jpg)',
      '![Two](/two.jpg)',
      '',
      'Middle.',
      '',
      '![Three](/three.jpg)',
      '![Four](/four.jpg)',
      '![Five](/five.jpg)',
      '',
      'After.',
    ].join('\n');
    let editor = createEditor(source);

    for (let round = 0; round < 3; round += 1) {
      expect(galleryNodes(editor)).toHaveLength(2);
      expect(editor.getMarkdown()).toBe(source);
      const next = editor.getMarkdown();
      editor.destroy();
      editor = createEditor(next);
    }
    editor.destroy();
  });

  it('does not infer a gallery when multiple images share one line', () => {
    const source = '![One](/one.jpg) ![Two](/two.jpg)';
    const editor = createEditor(source);

    expect(galleryNodes(editor)).toHaveLength(0);
    expect(editor.getMarkdown()).toContain('![One](/one.jpg)');
    expect(editor.getMarkdown()).toContain('![Two](/two.jpg)');
    editor.destroy();
  });

  it.each([2, 3, 4])('round trips a %i-image caption gallery with a validated wrapper', count => {
    const items = Array.from({ length: count }, (_, index) => ({
      url: '/same image.jpg',
      alt: index === 0 ? 'A <special> & "alt"' : '',
      title: index === 0 ? 'Title & "one"' : '',
      caption: index === 0 ? 'Caption <one> & "quoted"' : null,
    }));
    const source = buildGalleryMarkdown(items);
    expect(source).toContain(`<div class="nono-image-gallery" data-nono-gallery="${count}">`);
    expect(source).toContain('src="/same image.jpg" alt="A &lt;special&gt; &amp; &quot;alt&quot;" title="Title &amp; &quot;one&quot;"');
    expect(source).toContain('<figcaption>Caption &lt;one&gt; &amp; &quot;quoted&quot;</figcaption>');
    expect(source).toContain('src="/same image.jpg" alt=""');

    const editor = createEditor(source);
    expect(galleryNodes(editor)).toHaveLength(1);
    const images = [];
    editor.state.doc.descendants(node => {
      if (node.type.name === 'image') images.push(node.attrs);
    });
    expect(images.map(image => image.alt)).toEqual(items.map(item => item.alt));
    expect(images.map(image => image.src)).toEqual(items.map(item => item.url));
    expect(images[0].title).toBe('Title & "one"');

    const reopened = createEditor(editor.getMarkdown());
    expect(reopened.getJSON()).toEqual(editor.getJSON());
    reopened.destroy();

    let galleryPos;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'imageGallery') galleryPos = pos;
    });
    const gallery = editor.state.doc.nodeAt(galleryPos);
    const edited = gallery.child(0).attrs;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(galleryPos + 1, undefined, { ...edited, caption: 'Edited caption' }));
    const output = editor.getMarkdown();
    expect(output).toContain(`data-nono-gallery="${count}"`);
    expect(output).toContain('<figcaption>Edited caption</figcaption>');
    expect(output).toContain('alt=""');
    editor.destroy();
  });

  it('deletes gallery images to zero without leaving invalid image placeholders', () => {
    const editor = createEditor(buildGalleryMarkdown([
      { url: '/first.jpg', alt: 'First' },
      { url: '/second.jpg', alt: 'Second' },
    ]));

    const selectFirstGalleryImage = () => {
      let galleryPos;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'imageGallery') galleryPos = pos;
      });
      expect(galleryPos).toEqual(expect.any(Number));
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, galleryPos + 1)));
    };

    selectFirstGalleryImage();
    editor.commands.deleteSelection();
    expect(editor.getMarkdown()).toContain('![Second](/second.jpg)');
    expect(editor.getMarkdown()).not.toContain('undefined');

    selectFirstGalleryImage();
    expect(() => editor.commands.deleteSelection()).not.toThrow();
    expect(() => editor.getMarkdown()).not.toThrow();
    expect(editor.getMarkdown()).not.toMatch(/!\[[^\]]*\]\(\s*\)/);
    expect(editor.getJSON().content.flatMap(node => node.content || []).filter(node => node.type === 'image')).toHaveLength(0);
    editor.destroy();
  });

  it('source-protects unsupported and malformed gallery HTML', () => {
    expect(requiresImageSourceMode('<div class="nono-image-gallery" data-nono-gallery="3"><img src="/one.jpg" alt=""><img src="/two.jpg" alt=""></div>')).toBe(true);
    expect(requiresImageSourceMode('<div class="nono-image-gallery" data-nono-gallery="2"><img src="/one.jpg"></div>')).toBe(true);
    expect(requiresImageSourceMode('<div class="nono-image-gallery" data-nono-gallery="9"><img src="/one.jpg"><img src="/two.jpg"></div>')).toBe(true);
    expect(requiresImageSourceMode('<div class="nono-image-gallery" data-nono-gallery="2"><p>text</p><img src="/two.jpg"></div>')).toBe(true);
  });
});
