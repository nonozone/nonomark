import {
  NonoEditor,
  findUnsupportedMarkdown,
  type MarkdownCompatibilityFeature,
  type NonoEditorProps,
} from '../src/index.js';

const props: NonoEditorProps = {
  modelValue: '# Typed',
  readonly: true,
  autofocus: false,
  uploadImages: async (files, onProgress) => {
    onProgress({ file: files[0], progress: 100 });
    return [{ url: 'https://example.com/image.png' }];
  },
};

const publicProps: InstanceType<typeof NonoEditor>['$props'] = {
  ...props,
  'onUpdate:modelValue': (value: string) => value.length,
  'onUpload-complete': (images) => images.map((image) => image.url),
};

const features: MarkdownCompatibilityFeature[] = findUnsupportedMarkdown('- [ ] typed');
void [publicProps, features];
