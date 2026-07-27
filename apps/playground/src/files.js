export const MAX_MARKDOWN_FILE_SIZE = 5 * 1024 * 1024;

export const readMarkdownFile = async (file, maxBytes = MAX_MARKDOWN_FILE_SIZE) => {
  if (!file || !/\.(?:md|markdown)$/i.test(file.name || '')) {
    throw new Error('Please choose a Markdown (.md) file.');
  }
  if (file.size > maxBytes) throw new Error('The Markdown file is too large.');
  return file.text();
};

const pad = (value) => String(value).padStart(2, '0');

export const createMarkdownFilename = (date = new Date()) => (
  `nonoMark-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.md`
);

export const createMarkdownExport = (content, date = new Date()) => ({
  filename: createMarkdownFilename(date),
  blob: new Blob([String(content ?? '')], { type: 'text/markdown;charset=utf-8' }),
});
// Playground-only local file helpers.
