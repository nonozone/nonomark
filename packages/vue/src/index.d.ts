import type { DefineComponent } from 'vue';
import type { ImageAsset, ImportRemoteImages, RemoteImageImportResult, RemoteImageReference, UploadImages } from '@nonoim/editor-core';
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
  importRemoteImages?: ImportRemoteImages | null;
  imageAccept?: string;
  maxImageSize?: number;
}

export type NonoEditorEmits = {
  'update:modelValue': (value: string) => true;
  warning: (message: string) => true;
  'upload-complete': (images: ImageAsset[]) => true;
  'upload-error': (error: unknown) => true;
  'upload-cancel': (files: File[]) => true;
  'remote-image-import-start': (images: RemoteImageReference[]) => true;
  'remote-image-import-complete': (result: RemoteImageImportResult) => true;
  'remote-image-import-error': (event: { error: unknown; references: RemoteImageReference[]; content: string }) => true;
};

export const NonoEditor: DefineComponent<NonoEditorProps, {}, {}, {}, {}, {}, {}, NonoEditorEmits>;
export const NonoMarkdownEditor: typeof NonoEditor;
export default NonoEditor;
