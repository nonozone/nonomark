import { Suspense, defineAsyncComponent, defineComponent, h } from 'vue';
import './style.css';
import './interaction.css';

let editorModulePromise;

export const preloadNonoEditor = () => {
  editorModulePromise ||= import('./NonoEditor.vue');
  return editorModulePromise;
};

const AsyncNonoEditor = defineAsyncComponent({
  loader: async () => (await preloadNonoEditor()).default,
  suspensible: true,
});

export const NonoLazyEditor = defineComponent({
  name: 'NonoLazyEditor',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 10 },
    fill: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    const update = (value) => emit('update:modelValue', value);
    const fallback = () => {
      if (slots.fallback) return slots.fallback({ modelValue: props.modelValue, update });
      const minHeight = props.fill ? '640px' : `${Math.max(420, props.rows * 32)}px`;
      return h('div', {
        class: ['nono-rich-editor', props.fill && 'nono-rich-editor--fill', props.disabled && 'is-disabled', props.readonly && 'is-readonly'],
      }, [
        h('div', { class: 'nono-rich-editor__shell' }, [
          h('textarea', {
            value: props.modelValue,
            class: 'nono-rich-editor__source nono-rich-editor__lazy-fallback',
            style: { '--nono-editor-min-height': minHeight },
            placeholder: props.placeholder,
            disabled: props.disabled,
            readonly: props.readonly,
            autofocus: props.autofocus,
            spellcheck: false,
            'aria-label': props.placeholder || 'Markdown editor',
            onInput: (event) => update(event.target.value),
          }),
        ]),
      ]);
    };

    return () => h(Suspense, null, {
      default: () => h(AsyncNonoEditor, {
        ...attrs,
        ...props,
        'onUpdate:modelValue': update,
      }, slots),
      fallback,
    });
  },
});

export const NonoLazyMarkdownEditor = NonoLazyEditor;
export default NonoLazyEditor;
