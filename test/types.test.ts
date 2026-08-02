import {
  NonoEditor,
  createEditorBackup,
  createLocalImageUploader,
  findUnsupportedMarkdown,
  type EditorBackupController,
  type EditorImage,
  type ImportRemoteImages,
  type MarkdownCompatibilityFeature,
  type NonoEditorProps,
  type UploadImages,
} from '../packages/vue/src/index.js';
import {
  createS3ImageUploader,
  type S3UploadRequest,
} from '../packages/core/src/uploadS3.js';
import {
  NonoEditor as ReactNonoEditor,
  type NonoEditorProps as ReactNonoEditorProps,
} from '@nonoim/editor-react';

const standardUpload: UploadImages = async (files, { signal, onProgress }) => {
  if (signal.aborted) return [];
  onProgress({ file: files[0], loaded: 1, total: 1, percentage: 100 });
  return [{ url: 'https://example.com/image.png', provider: 's3', key: 'image.png' }];
};

const legacyUpload: UploadImages = async (files, onProgress) => {
  onProgress({ file: files[0], progress: 100 });
  return [{ url: 'https://example.com/legacy.png' }];
};

const props: NonoEditorProps = {
  modelValue: '# Typed',
  readonly: true,
  autofocus: false,
  allowBase64Images: true,
  uploadImages: standardUpload,
  importRemoteImages: async (images) => images.map((image) => ({ id: image.id, url: `/uploads/${image.id}.webp` })),
};

const publicProps: InstanceType<typeof NonoEditor>['$props'] = {
  ...props,
  'onUpdate:modelValue': (value: string) => value.length,
  'onUpload-complete': (images) => images.map((image) => image.url),
};

const features: MarkdownCompatibilityFeature[] = findUnsupportedMarkdown('- [ ] typed');
const localUpload: UploadImages = createLocalImageUploader();
const signedRequest: S3UploadRequest = {
  uploadUrl: 'https://upload.example/image.png',
  publicUrl: 'https://images.example/image.png',
  key: 'images/image.png',
};
const s3Upload: UploadImages = createS3ImageUploader({
  getUploadRequest: async () => signedRequest,
});
const assets: EditorImage[] = [{ url: 'data:image/png;base64,AAAA', provider: 'local-data-url', size: 4 }];
const remoteImport: ImportRemoteImages = async (images, { signal }) => signal.aborted ? [] : images.map((image) => ({ id: image.id, sourceUrl: image.url, url: `https://cdn.example/${image.id}.webp` }));
const reactProps: ReactNonoEditorProps = { value: '# React', onChange: (value) => value.length, uploadImages: standardUpload, importRemoteImages: remoteImport };
type ArticleBackup = { title: string; markdown: string };
const backupStorage = new Map<string, string>();
const editorBackup: EditorBackupController<ArticleBackup> = createEditorBackup<ArticleBackup>({
  backupKey: 'admin-1:posts:post-1',
  storage: {
    getItem: (key) => backupStorage.get(key) ?? null,
    setItem: (key, value) => backupStorage.set(key, value),
    removeItem: (key) => backupStorage.delete(key),
  },
});
editorBackup.schedule({ title: 'Typed', markdown: '# Typed' });
void [publicProps, features, legacyUpload, localUpload, s3Upload, assets, ReactNonoEditor, reactProps, editorBackup];
