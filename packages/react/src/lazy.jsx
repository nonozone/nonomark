import { Suspense, lazy } from 'react';
import './style.css';
import './interaction.css';

let editorModulePromise;

export const preloadNonoEditor = () => {
  editorModulePromise ||= import('./NonoEditor.jsx');
  return editorModulePromise;
};

const AsyncNonoEditor = lazy(async () => {
  const editorModule = await preloadNonoEditor();
  return { default: editorModule.NonoEditor || editorModule.default };
});

export function NonoLazyEditor({
  value = '',
  onChange = () => {},
  placeholder = '',
  rows = 10,
  fill = false,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  fallback = null,
  ...props
}) {
  const minHeight = fill ? '640px' : `${Math.max(420, rows * 32)}px`;
  const fallbackNode = fallback || <div className={`nono-rich-editor${fill ? ' nono-rich-editor--fill' : ''}${disabled ? ' is-disabled' : ''}${readOnly ? ' is-readonly' : ''}`}>
    <div className="nono-rich-editor__shell">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        className="nono-rich-editor__source nono-rich-editor__lazy-fallback"
        style={{ '--nono-editor-min-height': minHeight }}
        spellCheck="false"
        aria-label={placeholder || 'Markdown editor'}
      />
    </div>
  </div>;

  return <Suspense fallback={fallbackNode}>
    <AsyncNonoEditor
      {...props}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      fill={fill}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
    />
  </Suspense>;
}

export const NonoLazyMarkdownEditor = NonoLazyEditor;
export default NonoLazyEditor;
