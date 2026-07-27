export type MarkdownCompatibilityFeature = 'task-list' | 'frontmatter' | 'footnote' | 'raw-html';
export type ImageUploadStatus = 'uploading' | 'success' | 'error' | 'cancelled';

export interface ImageAsset {
  url: string;
  alt?: string;
  title?: string;
  id?: string;
  provider?: string;
  key?: string;
  mimeType?: string;
  size?: number;
}

export type EditorImage = ImageAsset;
export type UploadProgress = {
  file?: File;
  name?: string;
  loaded?: number;
  total?: number;
  percentage?: number;
  /** @deprecated Use percentage. */
  progress?: number;
  status?: ImageUploadStatus;
} | number;
export type UploadProgressHandler = (progress: UploadProgress) => void;
export type UploadContext = UploadProgressHandler & {
  signal: AbortSignal;
  onProgress: UploadProgressHandler;
};
export type UploadImages = (files: File[], context: UploadContext) => Promise<ImageAsset[]>;

export interface LocalImageUploaderOptions {
  provider?: string;
  dataUrlPattern?: RegExp;
  readFile?: (file: File, signal?: AbortSignal) => Promise<string>;
}

export function createLocalImageUploader(options?: LocalImageUploaderOptions): UploadImages;
export function containsRawHtml(value?: string): boolean;
export function findUnsupportedMarkdown(value?: string): MarkdownCompatibilityFeature[];
export function requiresSourceMode(value?: string): boolean;
