const RAW_HTML = /<!--[^]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?\s*\/?>/m;
const TASK_LIST = /^\s*[-+*]\s+\[[ xX]\]\s+/m;
const FRONTMATTER = /^(?:\uFEFF)?(?:---|\+\+\+)\s*\n[^]*?\n(?:---|\+\+\+)\s*(?:\n|$)/;
const FOOTNOTE = /\[\^[^\]\n]+\](?::|\b)/m;
// The image adapters preserve this exact standard-HTML figure shape. Other
// HTML remains protected instead of being silently converted.
const IMAGE_FIGURE = /<figure>\s*<img\s+src="[^"<>]+"\s+alt="[^"<>]*"(?:\s+title="[^"<>]*")?\s*\/?>(?:\s*<figcaption>[^<>]*<\/figcaption>)?\s*<\/figure>/g;

export const containsRawHtml = (value) => RAW_HTML.test(value || '');

export const findUnsupportedMarkdown = (value) => {
  const markdown = String(value || '').replace(IMAGE_FIGURE, '');
  const features = [];
  if (TASK_LIST.test(markdown)) features.push('task-list');
  if (FRONTMATTER.test(markdown)) features.push('frontmatter');
  if (FOOTNOTE.test(markdown)) features.push('footnote');
  if (containsRawHtml(markdown)) features.push('raw-html');
  return features;
};

export const requiresSourceMode = (value) => findUnsupportedMarkdown(value).length > 0;
