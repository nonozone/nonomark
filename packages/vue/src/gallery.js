const escapeText = (value) => String(value || '').replace(/\r?\n/g, ' ').trim();
const escapeAlt = (value) => escapeText(value).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
const imageUrl = (value) => {
  const url = String(value || '').trim();
  if (!url || /^(?:javascript|vbscript):/i.test(url) || /[\r\n]/.test(url)) throw new Error('Gallery images need a valid URL.');
  return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
};

export const buildGalleryMarkdown = (items) => {
  if (!Array.isArray(items) || items.length < 2 || items.length > 4) throw new Error('A gallery needs 2 to 4 images.');
  const images = items.map(({ url, alt, title, caption }) => {
    const description = escapeAlt(caption || alt || 'image');
    const name = title ? ` "${String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"` : '';
    return `![${description}](${imageUrl(url)}${name})`;
  });
  return images.join('\n');
};
