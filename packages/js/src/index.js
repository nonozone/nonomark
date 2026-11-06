import { createApp, h, ref } from 'vue';
import NonoEditor from '../../vue/src/NonoEditor.vue';
import editorStyles from '../../vue/src/style.css?inline';

const PROP_NAMES = [
  'placeholder', 'rows', 'help', 'fill', 'disabled', 'readonly', 'autofocus',
  'allowBase64Images', 'locale', 'uploadImages', 'importRemoteImages',
  'imageAccept', 'maxImageSize', 'autoSourceMode', 'enableGallery',
];

const EVENT_NAMES = {
  onChange: 'onChange',
  onWarning: 'onWarning',
  onUploadComplete: 'onUploadComplete',
  onUploadError: 'onUploadError',
  onUploadCancel: 'onUploadCancel',
  onRemoteImageImportStart: 'onRemoteImageImportStart',
  onRemoteImageImportComplete: 'onRemoteImageImportComplete',
  onRemoteImageImportError: 'onRemoteImageImportError',
  onGalleryPickImage: 'onGalleryPickImage',
};

let stylesInstalled = false;

const installStyles = () => {
  if (stylesInstalled || typeof document === 'undefined' || !editorStyles) return;
  const style = document.createElement('style');
  style.dataset.nonoEditor = 'editor-js';
  style.textContent = editorStyles;
  document.head.appendChild(style);
  stylesInstalled = true;
};

const resolveElement = target => {
  if (typeof target === 'string') {
    const element = document.querySelector(target);
    if (!element) throw new Error(`NonoEditor target was not found: ${target}`);
    return element;
  }
  if (target && target.nodeType === 1) return target;
  throw new TypeError('NonoEditor target must be a DOM element or selector.');
};

const pickProps = (options, value, onUpdate) => {
  const props = { modelValue: value.value, 'onUpdate:modelValue': onUpdate };
  for (const name of PROP_NAMES) {
    if (options[name] !== undefined) props[name] = options[name];
  }
  for (const [name, listener] of Object.entries(EVENT_NAMES)) {
    if (typeof options[name] === 'function') props[listener] = options[name];
  }
  return props;
};

/**
 * Mount the nonoMark editor into a browser DOM element without Vue or React
 * in the consuming application.
 *
 * The target's existing children are replaced by the editor root. Call
 * destroy() before reusing the target for another application.
 */
export const createNonoEditor = (target, options = {}) => {
  if (typeof document === 'undefined') throw new Error('NonoEditor requires a browser document.');
  const element = resolveElement(target);
  installStyles();
  const value = ref(String(options.value ?? options.modelValue ?? ''));
  let destroyed = false;
  let app;
  const onUpdate = nextValue => {
    value.value = String(nextValue ?? '');
    options.onChange?.(value.value);
  };
  const Root = {
    name: 'NonoEditorJSRoot',
    setup: () => () => h(NonoEditor, pickProps(options, value, onUpdate)),
  };
  app = createApp(Root);
  app.mount(element);

  return {
    element,
    getValue: () => value.value,
    setValue: nextValue => {
      if (destroyed) return;
      value.value = String(nextValue ?? '');
    },
    focus: () => {
      if (destroyed) return;
      element.querySelector('[contenteditable], textarea')?.focus();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      app.unmount();
    },
  };
};

export { NonoEditor };
export * from '../../core/src/index.js';

export default createNonoEditor;
