export * from './editorBackup.js';

export type MarkdownCompatibilityFeature = 'task-list' | 'frontmatter' | 'footnote' | 'raw-html';
export type ImageUploadStatus = 'uploading' | 'success' | 'error' | 'cancelled';

export interface ImageAsset {
  url: string;
  /** Optional original URL used to match partial remote-image import results. */
  sourceUrl?: string;
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

export interface RemoteImageReference {
  id: string;
  url: string;
  alt?: string;
  title?: string;
  format: 'markdown' | 'html';
}

export type ImportRemoteImages = (
  images: RemoteImageReference[],
  context: UploadContext,
) => Promise<ImageAsset[]>;

export interface RemoteImageImportResult {
  content: string;
  references: RemoteImageReference[];
  imported: ImageAsset[];
  failed: Array<{ reference: RemoteImageReference }>;
}

export interface RemoteImageDetectionOptions {
  format?: 'auto' | 'markdown' | 'html';
}

export interface LocalImageUploaderOptions {
  provider?: string;
  dataUrlPattern?: RegExp;
  readFile?: (file: File, signal?: AbortSignal) => Promise<string>;
}

export function createLocalImageUploader(options?: LocalImageUploaderOptions): UploadImages;
export function findRemoteImageReferences(content?: string, options?: RemoteImageDetectionOptions): RemoteImageReference[];
export function replaceRemoteImageReferences(content: string, references: RemoteImageReference[], assets: ImageAsset[]): string;
export function importRemoteImagesFromContent(
  content: string,
  importRemoteImages: ImportRemoteImages,
  context: UploadContext,
  options?: RemoteImageDetectionOptions,
): Promise<RemoteImageImportResult>;
export function containsRawHtml(value?: string): boolean;
export function findUnsupportedMarkdown(value?: string): MarkdownCompatibilityFeature[];
export function requiresSourceMode(value?: string): boolean;
