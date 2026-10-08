import { imageHtml, imageMarkdown } from './imageMarkdown.js';

export const buildGalleryMarkdown = (items) => {
  if (!Array.isArray(items) || items.length < 2 || items.length > 4) throw new Error('A gallery needs 2 to 4 images.');
  if (items.some(item => item.caption)) {
    return `<div class="nono-image-gallery" data-nono-gallery="${items.length}">\n${items.map(item => imageHtml({ ...item, caption: item.caption || null })).join('\n')}\n</div>`;
  }
  return items.map(item => imageMarkdown({ ...item, caption: null })).join('\n');
};
