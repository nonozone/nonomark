import {
  NonoEditor,
  createLocalImageUploader,
  findUnsupportedMarkdown,
  type EditorImage,
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
const reactProps: ReactNonoEditorProps = { value: '# React', onChange: (value) => value.length, uploadImages: standardUpload };
void [publicProps, features, legacyUpload, localUpload, s3Upload, assets, ReactNonoEditor, reactProps];
