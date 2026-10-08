import { imageMarkdown } from './imageProperties.js';

export const buildGalleryMarkdown = (items) => {
  if (!Array.isArray(items) || items.length < 2 || items.length > 4) throw new Error('A gallery needs 2 to 4 images.');
  const images = items.map(item => imageMarkdown({ ...item, caption: item.caption || null }));
  // HTML blocks need a blank line before the following Markdown image.
  return images.join(items.some(item => item.caption) ? '\n\n' : '\n');
};
