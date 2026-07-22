import type { DefineComponent } from 'vue';

export type MarkdownCompatibilityFeature = 'task-list' | 'frontmatter' | 'footnote' | 'raw-html';
export type EditorImage = { url: string; alt?: string };
export type UploadProgress = { file?: File; name?: string; progress?: number; status?: string } | number;
export type UploadImages = (files: File[], onProgress: (progress: UploadProgress) => void) => Promise<EditorImage[]>;

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
};

export const NonoEditor: DefineComponent<NonoEditorProps, {}, {}, {}, {}, {}, {}, NonoEditorEmits>;
export const NonoMarkdownEditor: typeof NonoEditor;
export function containsRawHtml(value?: string): boolean;
export function findUnsupportedMarkdown(value?: string): MarkdownCompatibilityFeature[];
export function requiresSourceMode(value?: string): boolean;
export default NonoEditor;
