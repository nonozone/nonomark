const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeAlt = value => String(value ?? '').replace(/[\\`*_\[\]]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, ' ');

export const imageHtml = ({ src, url, alt = '', title = '', caption = null }) => {
  const href = String(src ?? url ?? '').trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href) || /^(?:javascript|vbscript):/i.test(href)) throw new Error('Images need a valid URL.');
  const image = `<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;
  return caption === null || caption === undefined ? image : `<figure>${image}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
};

// Plain images keep their portable Markdown form. An explicitly edited caption
// (including an empty one) is independent of alt and uses standard HTML figures.
export const imageMarkdown = ({ src, url, alt = '', title = '', caption = null }) => {
  const href = String(src ?? url ?? '').trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href) || /^(?:javascript|vbscript):/i.test(href)) throw new Error('Images need a valid URL.');
  if (caption !== null && caption !== undefined) {
    return imageHtml({ src: href, alt, title, caption });
  }
  const name = title ? ` "${String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"` : '';
  return `![${escapeAlt(alt)}](${href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}${name})`;
};
