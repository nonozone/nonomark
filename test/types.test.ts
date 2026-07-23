import {
  NonoEditor,
  createLocalImageUploader,
  findUnsupportedMarkdown,
  type EditorImage,
  type MarkdownCompatibilityFeature,
  type NonoEditorProps,
  type UploadImages,
} from '../src/index.js';

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
const assets: EditorImage[] = [{ url: 'data:image/png;base64,AAAA', provider: 'local-data-url', size: 4 }];
void [publicProps, features, legacyUpload, localUpload, assets];
