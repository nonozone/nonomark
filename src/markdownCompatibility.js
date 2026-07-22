const RAW_HTML = /<!--[^]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?\s*\/?>/m;
const TASK_LIST = /^\s*[-+*]\s+\[[ xX]\]\s+/m;
const FRONTMATTER = /^(?:\uFEFF)?(?:---|\+\+\+)\s*\n[^]*?\n(?:---|\+\+\+)\s*(?:\n|$)/;
const FOOTNOTE = /\[\^[^\]\n]+\](?::|\b)/m;

export const containsRawHtml = (value) => RAW_HTML.test(value || '');

export const findUnsupportedMarkdown = (value) => {
  const markdown = value || '';
  const features = [];
  if (TASK_LIST.test(markdown)) features.push('task-list');
  if (FRONTMATTER.test(markdown)) features.push('frontmatter');
  if (FOOTNOTE.test(markdown)) features.push('footnote');
  if (containsRawHtml(markdown)) features.push('raw-html');
  return features;
};

export const requiresSourceMode = (value) => findUnsupportedMarkdown(value).length > 0;
