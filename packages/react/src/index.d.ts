import type { ReactNode } from 'react';
import type { ImageAsset, ImportRemoteImages, RemoteImageImportResult, RemoteImageReference, UploadImages } from '@nonoim/editor-core';
export * from '@nonoim/editor-core';

export interface NonoEditorProps {
  value?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  rows?: number;
  help?: string;
  fill?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  allowBase64Images?: boolean;
  locale?: string;
  uploadImages?: UploadImages | null;
  importRemoteImages?: ImportRemoteImages | null;
  imageAccept?: string;
  maxImageSize?: number;
  onWarning?: (message: string) => void;
  onUploadComplete?: (images: ImageAsset[]) => void;
  onUploadError?: (error: unknown) => void;
  onUploadCancel?: (files: File[]) => void;
  onRemoteImageImportStart?: (images: RemoteImageReference[]) => void;
  onRemoteImageImportComplete?: (result: RemoteImageImportResult) => void;
  onRemoteImageImportError?: (event: { error: unknown; references: RemoteImageReference[]; content: string }) => void;
  toolbarEnd?: ReactNode;
  footerStatus?: ReactNode;
}

export function NonoEditor(props: NonoEditorProps): ReactNode;
export const NonoMarkdownEditor: typeof NonoEditor;
export default NonoEditor;
