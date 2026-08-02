const REFERENCE_POSITIONS = Symbol('remote-image-reference-positions');

const isRemoteUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const codeRanges = (content) => {
  const ranges = [];
  const lines = content.split(/(?<=\n)/);
  let offset = 0;
  let fence = null;
  for (const line of lines) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence && marker) fence = { char: marker[1][0], length: marker[1].length, start: offset };
    else if (fence && marker && marker[1][0] === fence.char && marker[1].length >= fence.length) {
      ranges.push([fence.start, offset + line.length]);
      fence = null;
    }
    offset += line.length;
  }
  if (fence) ranges.push([fence.start, content.length]);

  const htmlCode = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  for (const match of content.matchAll(htmlCode)) ranges.push([match.index, match.index + match[0].length]);

  let index = 0;
  while (index < content.length) {
    if (ranges.some(([start, end]) => index >= start && index < end)) { index += 1; continue; }
    if (content[index] !== '`') { index += 1; continue; }
    let length = 1;
    while (content[index + length] === '`') length += 1;
    const closing = content.indexOf('`'.repeat(length), index + length);
    if (closing < 0) { index += length; continue; }
    ranges.push([index, closing + length]);
    index = closing + length;
  }
  return ranges;
};

const isCovered = (index, ranges) => ranges.some(([start, end]) => index >= start && index < end);
const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : undefined;
};

const attachPositions = (reference, start, end) => {
  Object.defineProperty(reference, REFERENCE_POSITIONS, { value: { start, end }, enumerable: false });
  return reference;
};

export function findRemoteImageReferences(content = '', options = {}) {
  const value = String(content || '');
  const format = options.format || 'auto';
  const ranges = codeRanges(value);
  const found = [];
  const add = ({ url, alt, title, format: imageFormat, start, end }) => {
    if (!isRemoteUrl(url) || isCovered(start, ranges)) return;
    found.push({ url, alt, title, format: imageFormat, start, end });
  };

  if (format === 'auto' || format === 'markdown') {
    const markdownImage = /!\[((?:\\.|[^\]\\])*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|\(((?:\\.|[^)\\])*)\)))?\s*\)/g;
    for (const match of value.matchAll(markdownImage)) {
      const rawUrl = match[2] ?? match[3];
      const relative = match[0].indexOf(rawUrl);
      add({
        url: rawUrl,
        alt: match[1] || undefined,
        title: match[4] ?? match[5] ?? match[6] ?? undefined,
        format: 'markdown',
        start: match.index + relative,
        end: match.index + relative + rawUrl.length,
      });
    }
  }

  if (format === 'auto' || format === 'html') {
    const htmlImage = /<img\b[^>]*>/gi;
    for (const match of value.matchAll(htmlImage)) {
      const rawUrl = attribute(match[0], 'src');
      if (!rawUrl) continue;
      const relative = match[0].indexOf(rawUrl);
      add({
        url: rawUrl,
        alt: attribute(match[0], 'alt'),
        title: attribute(match[0], 'title'),
        format: 'html',
        start: match.index + relative,
        end: match.index + relative + rawUrl.length,
      });
    }
  }

  return found
    .sort((left, right) => left.start - right.start)
    .map((item, index) => attachPositions({
      id: `remote-image-${index + 1}`,
      url: item.url,
      alt: item.alt,
      title: item.title,
      format: item.format,
    }, item.start, item.end));
}

const matchAssets = (references, assets) => references.map((reference, index) => {
  const byId = assets.find((asset) => asset?.id && asset.id === reference.id);
  const bySource = assets.find((asset) => asset?.sourceUrl && asset.sourceUrl === reference.url);
  const positional = assets[index]?.id || assets[index]?.sourceUrl ? undefined : assets[index];
  const asset = byId || bySource || positional;
  return typeof asset?.url === 'string' && asset.url ? asset : undefined;
});

export function replaceRemoteImageReferences(content, references, assets) {
  const value = String(content || '');
  const refs = Array.isArray(references) ? references : [];
  const matches = matchAssets(refs, Array.isArray(assets) ? assets : []);
  const discovered = refs.every((reference) => reference?.[REFERENCE_POSITIONS])
    ? refs
    : findRemoteImageReferences(value);
  const edits = discovered.flatMap((reference, index) => {
    const asset = matches[index];
    const positions = reference[REFERENCE_POSITIONS];
    return asset?.url && positions ? [{ ...positions, url: asset.url }] : [];
  }).sort((left, right) => right.start - left.start);
  return edits.reduce((output, edit) => `${output.slice(0, edit.start)}${edit.url}${output.slice(edit.end)}`, value);
}

export async function importRemoteImagesFromContent(content, importRemoteImages, context, options = {}) {
  if (typeof importRemoteImages !== 'function') throw new TypeError('importRemoteImages must be a function.');
  const references = findRemoteImageReferences(content, options);
  if (!references.length) return { content: String(content || ''), references, imported: [], failed: [] };
  const assets = await importRemoteImages(references, context);
  if (!Array.isArray(assets)) throw new TypeError('importRemoteImages must resolve to an array of image assets.');
  const matches = matchAssets(references, assets);
  return {
    content: replaceRemoteImageReferences(content, references, assets),
    references,
    imported: matches.filter(Boolean),
    failed: references.flatMap((reference, index) => matches[index] ? [] : [{ reference }]),
  };
}
