import type { DefineComponent } from 'vue';
import type { ImageAsset, UploadImages } from '@nonoim/editor-core';
export * from '@nonoim/editor-core';

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
  'upload-complete': (images: ImageAsset[]) => true;
  'upload-error': (error: unknown) => true;
  'upload-cancel': (files: File[]) => true;
};

export const NonoEditor: DefineComponent<NonoEditorProps, {}, {}, {}, {}, {}, {}, NonoEditorEmits>;
export const NonoMarkdownEditor: typeof NonoEditor;
export default NonoEditor;
