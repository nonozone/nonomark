import { describe, expect, it, vi } from 'vitest';
import {
  findRemoteImageReferences,
  importRemoteImagesFromContent,
  replaceRemoteImageReferences,
} from '../packages/core/src/remoteImages.js';

const context = () => {
  const controller = new AbortController();
  const report = vi.fn();
  return Object.assign(report, { signal: controller.signal, onProgress: report });
};

describe('remote image imports', () => {
  it('finds Markdown images while preserving alt and title', () => {
    const content = 'Before ![A photo](https://old.example/a.jpg "Cover") after';
    expect(findRemoteImageReferences(content)).toEqual([
      expect.objectContaining({
        id: 'remote-image-1',
        url: 'https://old.example/a.jpg',
        alt: 'A photo',
        title: 'Cover',
        format: 'markdown',
      }),
    ]);
  });

  it('ignores image-like text in code and non-remote URLs', () => {
    const content = [
      '`![inline](https://old.example/inline.jpg)`',
      '```md',
      '![fenced](https://old.example/fenced.jpg)',
      '```',
      '![relative](./image.jpg)',
      '![data](data:image/png;base64,AAAA)',
      '![remote](https://old.example/real.jpg)',
    ].join('\n');
    expect(findRemoteImageReferences(content).map(({ url }) => url)).toEqual([
      'https://old.example/real.jpg',
    ]);
  });

  it('finds HTML images and preserves their attributes', () => {
    const content = '<p><img class="hero" src="https://old.example/a.jpg" alt="A &amp; B" title="Cover"></p>';
    expect(findRemoteImageReferences(content, { format: 'html' })).toEqual([
      expect.objectContaining({
        url: 'https://old.example/a.jpg',
        alt: 'A &amp; B',
        title: 'Cover',
        format: 'html',
      }),
    ]);
  });

  it('replaces each duplicate reference independently', () => {
    const content = '![one](https://old.example/a.jpg) ![two](https://old.example/a.jpg)';
    const references = findRemoteImageReferences(content);
    const replaced = replaceRemoteImageReferences(content, references, [
      { id: references[0].id, url: 'https://new.example/one.jpg' },
      { id: references[1].id, url: 'https://new.example/two.jpg' },
    ]);
    expect(replaced).toBe('![one](https://new.example/one.jpg) ![two](https://new.example/two.jpg)');
  });

  it('keeps failed references unchanged and reports them', async () => {
    const content = '![one](https://old.example/one.jpg) ![two](https://old.example/two.jpg "Two")';
    const importer = vi.fn(async ([first]) => [
      { id: first.id, url: 'https://new.example/one.jpg' },
    ]);
    const result = await importRemoteImagesFromContent(content, importer, context());

    expect(importer).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('![one](https://new.example/one.jpg) ![two](https://old.example/two.jpg "Two")');
    expect(result.imported).toHaveLength(1);
    expect(result.failed).toEqual([{ reference: result.references[1] }]);
  });
});
