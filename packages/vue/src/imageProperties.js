import Image from '@tiptap/extension-image';
import { Extension, mergeAttributes } from '@tiptap/core';
import { findUnsupportedMarkdown } from '@nonoim/editor-core';

const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeAlt = value => String(value ?? '').replace(/[\\`*_\[\]]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, ' ');

// Plain images keep their portable Markdown form. An explicitly edited caption
// (including an empty one) is independent of alt and uses standard HTML figures.
export const imageMarkdown = ({ src, url, alt = '', title = '', caption = null }) => {
  const href = String(src ?? url ?? '').trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href) || /^(?:javascript|vbscript):/i.test(href)) throw new Error('Images need a valid URL.');
  if (caption !== null && caption !== undefined) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const visibleCaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
    return `<figure><img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"${titleAttr}>${visibleCaption}</figure>`;
  }
  const name = title ? ` "${String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"` : '';
  return `![${escapeAlt(alt)}](${href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}${name})`;
};

export const imageMarkdownFeatures = markdown => findUnsupportedMarkdown(markdown);
export const requiresImageSourceMode = markdown => imageMarkdownFeatures(markdown).length > 0;

// Consecutive Markdown images are lexed as one paragraph. Lift block images
// out of it so attribute transactions operate on a valid ProseMirror document.
const ImageParagraphs = Extension.create({
  name: 'imageParagraphs',
  priority: 1100,
  markdownTokenName: 'paragraph',
  renderMarkdown(node, helpers, context) {
    if (node.content?.length) return helpers.renderChildren(node.content);
    return context?.previousNode?.type === 'paragraph' && !context.previousNode.content?.length ? '&nbsp;' : '';
  },
  parseMarkdown(token, helpers) {
    if (!token.tokens?.some(item => item.type === 'image')) return null;
    const result = [];
    let inline = [];
    const flush = () => {
      if (inline.some(node => node.type !== 'text' || node.text.trim())) result.push(helpers.createNode('paragraph', undefined, inline));
      inline = [];
    };
    for (const node of helpers.parseInline(token.tokens)) {
      if (node.type === 'image') { flush(); result.push(node); }
      else inline.push(node);
    }
    flush();
    return result;
  },
});

export const CaptionImage = Image.extend({
  addExtensions() { return [ImageParagraphs]; },
  addAttributes() {
    return { ...this.parent?.(), caption: { default: null, rendered: false } };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: element => {
          const img = element.querySelector(':scope > img');
          if (!img || (!this.options.allowBase64 && img.getAttribute('src')?.startsWith('data:'))) return false;
          return { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '', title: img.getAttribute('title'), caption: element.querySelector(':scope > figcaption')?.textContent || '' };
        }
      },
      ...this.parent?.()
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    if (node.attrs.caption === null) return ['img', attrs];
    return ['figure', {}, ['img', attrs], ...(node.attrs.caption ? [['figcaption', {}, node.attrs.caption]] : [])];
  },
  parseMarkdown(token, helpers) {
    const text = nodes => nodes.map(node => node.text ?? (node.content ? text(node.content) : '')).join('');
    return helpers.createNode('image', { src: token.href, title: token.title, alt: token.tokens ? text(helpers.parseInline(token.tokens)) : (token.text || '') });
  },
  renderMarkdown(node) { return imageMarkdown(node.attrs); }
});

export const imageToolsPosition = (surface, node, panelHeight = 40) => {
  const outer = surface.getBoundingClientRect(), rect = (node.querySelector?.('img') || node).getBoundingClientRect();
  const width = Math.max(0, Math.min(340, outer.width - 24));
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportTop = window.visualViewport?.offsetTop || 0;
  const visibleTop = Math.max(rect.top + 8, viewportTop + 8);
  const top = Math.max(outer.top + 4, Math.min(visibleTop, outer.bottom - panelHeight - 8, viewportTop + viewportHeight - Math.min(panelHeight, viewportHeight - 16) - 8));
  const maxHeight = Math.max(80, Math.min(outer.bottom, viewportTop + viewportHeight) - Math.max(outer.top, viewportTop) - 64);
  return { top: `${Math.max(4, top - outer.top)}px`, left: `${Math.max(12, Math.min(rect.right - outer.left - width - 8, outer.width - width - 12))}px`, width: `${width}px`, '--nono-image-panel-max-height': `${maxHeight}px` };
};
