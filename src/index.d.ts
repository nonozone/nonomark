import type { DefineComponent } from 'vue';

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

export interface NonoEditorProps {
  modelValue?: string;
  placeholder?: string;
  rows?: number;
  help?: string;
  fill?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  autofocus?: boolean;
  allowBase64Images?: boolean;
  locale?: string;
  uploadImages?: UploadImages | null;
  imageAccept?: string;
  maxImageSize?: number;
}

export type NonoEditorEmits = {
  'update:modelValue': (value: string) => true;
  warning: (message: string) => true;
  'upload-complete': (images: EditorImage[]) => true;
  'upload-error': (error: unknown) => true;
  'upload-cancel': (files: File[]) => true;
};

export const NonoEditor: DefineComponent<NonoEditorProps, {}, {}, {}, {}, {}, {}, NonoEditorEmits>;
export const NonoMarkdownEditor: typeof NonoEditor;
export function containsRawHtml(value?: string): boolean;
export function findUnsupportedMarkdown(value?: string): MarkdownCompatibilityFeature[];
export function requiresSourceMode(value?: string): boolean;
export default NonoEditor;
