import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { NodeSelection } from '@tiptap/pm/state';
import { Placeholder } from '@tiptap/extensions';
import { findRemoteImageReferences, findUnsupportedMarkdown, importRemoteImagesFromContent, requiresSourceMode } from '@nonoim/editor-core';

const DEFAULT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
const cx = (...values) => values.filter(Boolean).join(' ');
const selectImageOnMouseDown = (view, event) => { const target = event.target; if (target?.tagName !== 'IMG' || !view.editable) return false; const position = view.posAtDOM(target, 0); if (view.state.doc.nodeAt(position)?.type.name !== 'image') return false; view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position))); view.focus(); event.preventDefault(); return true; };

export function NonoEditor({
  value = '', onChange = () => {}, placeholder = '', rows = 10, help = '', fill = false,
  disabled = false, readOnly = false, autoFocus = false, allowBase64Images = false,
  locale = 'en', uploadImages = null, importRemoteImages = null, imageAccept = DEFAULT_IMAGE_ACCEPT,
  maxImageSize = 10 * 1024 * 1024, onWarning = () => {}, onUploadComplete = () => {},
  onUploadError = () => {}, onUploadCancel = () => {}, onRemoteImageImportStart = () => {},
  onRemoteImageImportComplete = () => {}, onRemoteImageImportError = () => {}, toolbarEnd = null, footerStatus = null,
}) {
  const tr = useCallback((en, zh, vars) => {
    let text = /^zh(?:-|$)/i.test(locale) ? (zh || en) : en;
    return vars ? text.replace(/\{(\w+)\}/g, (_match, key) => vars[key] == null ? '' : String(vars[key])) : text;
  }, [locale]);
  const editable = !disabled && !readOnly;
  const [sourceMode, setSourceMode] = useState(() => requiresSourceMode(value));
  const [sourceValue, setSourceValue] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const sourceRef = useRef(null);
  const sourceValueRef = useRef(sourceValue);
  const editorRef = useRef(null);
  const uploadController = useRef(null);
  const remoteImportController = useRef(null);
  const uploadingFiles = useRef([]);
  const lastPublished = useRef(null);
  const callbacks = useRef({ onChange, onUploadComplete, onUploadError, onUploadCancel, onRemoteImageImportStart, onRemoteImageImportComplete, onRemoteImageImportError });
  callbacks.current = { onChange, onUploadComplete, onUploadError, onUploadCancel, onRemoteImageImportStart, onRemoteImageImportComplete, onRemoteImageImportError };
  const remoteImporter = useRef(importRemoteImages);
  remoteImporter.current = importRemoteImages;

  const publish = useCallback((markdown) => {
    sourceValueRef.current = markdown;
    setSourceValue(markdown);
    lastPublished.current = markdown;
    callbacks.current.onChange(markdown);
  }, []);

  const insertSourceBlock = useCallback((block) => {
    const input = sourceRef.current;
    const current = sourceValueRef.current;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const before = start > 0 && current[start - 1] !== '\n' ? '\n\n' : '';
    const after = end < current.length && current[end] !== '\n' ? '\n\n' : '\n';
    publish(`${current.slice(0, start)}${before}${block}${after}${current.slice(end)}`);
  }, [publish]);

  const insertImages = useCallback((images) => {
    if (sourceMode) {
      insertSourceBlock(images.map(({ url, alt, title }) => `![${String(alt || 'image').replace(/\]/g, '\\]')}](${url}${title ? ` "${String(title).replace(/"/g, '\\"')}"` : ''})`).join('\n\n'));
      return;
    }
    const nodes = images.flatMap(({ url, alt, title }) => [{ type: 'image', attrs: { src: url, alt: alt || 'image', title: title || null } }, { type: 'paragraph' }]);
    if (nodes.length) editorRef.current?.chain().focus().insertContent(nodes).run();
  }, [insertSourceBlock, sourceMode]);

  const uploadFiles = useCallback(async (files) => {
    const items = Array.from(files || []);
    if (!items.length || !uploadImages || !editable || uploadController.current) return;
    const accepted = new Set(imageAccept.split(',').map((item) => item.trim()));
    const valid = [];
    for (const file of items) {
      const message = (!accepted.has(file.type) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || ''))
        ? tr('Unsupported image format.', '不支持该图片格式。')
        : file.size > maxImageSize ? tr('File exceeds the size limit.', '图片超过大小限制。') : '';
      if (message) { const error = new Error(message); setUploadStatus({ name: file.name, progress: 0, status: 'error', error: message }); callbacks.current.onUploadError(error); }
      else valid.push(file);
    }
    if (!valid.length) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(true);
    uploadingFiles.current = valid;
    const report = (input = 0) => {
      if (controller.signal.aborted) return;
      const data = typeof input === 'number' ? { percentage: input } : (input || {});
      const ratio = Number(data.total) > 0 ? Number(data.loaded) / Number(data.total) * 100 : 0;
      setUploadStatus({ name: data.name || data.file?.name || valid[0].name, progress: Math.max(0, Math.min(100, Number(data.percentage ?? data.progress ?? ratio) || 0)), status: data.status || 'uploading', error: '' });
    };
    Object.assign(report, { signal: controller.signal, onProgress: report });
    report(0);
    try {
      const result = await uploadImages(valid, report);
      if (controller.signal.aborted) throw new DOMException('Image upload was cancelled.', 'AbortError');
      const images = Array.isArray(result) ? result.filter((item) => item?.url) : [];
      if (!images.length) throw new Error(tr('The upload returned no image URLs.', '上传结果中没有可用的图片地址。'));
      insertImages(images);
      setUploadStatus({ name: tr('{count} images', '{count} 张图片', { count: images.length }), progress: 100, status: 'success', error: '' });
      callbacks.current.onUploadComplete(images);
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') setUploadStatus((current) => ({ name: current?.name || valid[0].name, progress: current?.progress || 0, status: 'cancelled', error: '' }));
      else { setUploadStatus((current) => ({ name: current?.name || valid[0].name, progress: current?.progress || 0, status: 'error', error: error?.message || String(error) })); callbacks.current.onUploadError(error); }
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
      uploadingFiles.current = [];
      setUploading(false);
    }
  }, [editable, imageAccept, insertImages, maxImageSize, tr, uploadImages]);

  const remotePastePayload = (clipboardData) => {
    if (!clipboardData) return null;
    const candidates = [['markdown', clipboardData.getData?.('text/markdown')], ['markdown', clipboardData.getData?.('text/plain')], ['html', clipboardData.getData?.('text/html')]];
    for (const [format, content] of candidates) if (content && findRemoteImageReferences(content, { format }).length) return { content, format };
    return null;
  };
  const handleRemotePaste = useCallback((event, insert) => {
    if (!remoteImporter.current || !editable || remoteImportController.current) return false;
    const payload = remotePastePayload(event.clipboardData);
    if (!payload) return false;
    const references = findRemoteImageReferences(payload.content, { format: payload.format });
    const controller = new AbortController();
    const report = () => {};
    Object.assign(report, { signal: controller.signal, onProgress: report });
    remoteImportController.current = controller;
    event.preventDefault();
    callbacks.current.onRemoteImageImportStart(references);
    void importRemoteImagesFromContent(payload.content, remoteImporter.current, report, { format: payload.format }).then((result) => {
      if (controller.signal.aborted) return;
      insert(result.content, payload.format);
      callbacks.current.onRemoteImageImportComplete(result);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      insert(payload.content, payload.format);
      callbacks.current.onRemoteImageImportError({ error, references, content: payload.content });
    }).finally(() => { if (remoteImportController.current === controller) remoteImportController.current = null; });
    return true;
  }, [editable]);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    enableInputRules: true,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }), Image.configure({ allowBase64: allowBase64Images }), TableKit, Placeholder.configure({ placeholder: placeholder || tr('Start writing...', '开始输入正文…') }), Markdown],
    content: value || '',
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'nono-rich-editor__prosemirror', 'aria-label': placeholder || tr('Rich text editor', '富文本编辑器') },
      handleDOMEvents: { mousedown: selectImageOnMouseDown },
      handlePaste: (view, event) => { const files = event.clipboardData?.files; if (files?.length) { void uploadFiles(files); return true; } const range = { from: view.state.selection.from, to: view.state.selection.to }; return handleRemotePaste(event, (content, format) => editorRef.current?.commands.insertContentAt(range, content, { contentType: format })); },
      handleDrop: (_view, event) => { const files = event.dataTransfer?.files; if (!files?.length) return false; void uploadFiles(files); return true; },
    },
    onUpdate: ({ editor: instance }) => { publish(instance.getMarkdown()); setRevision((count) => count + 1); },
    onSelectionUpdate: () => setRevision((count) => count + 1),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }, [allowBase64Images, handleRemotePaste]);
  editorRef.current = editor;

  useEffect(() => { editor?.setEditable(editable); }, [editable, editor]);
  useEffect(() => {
    if (!editor || value === lastPublished.current) return;
    sourceValueRef.current = value || '';
    setSourceValue(value || '');
    if (requiresSourceMode(value)) setSourceMode(true);
    else if (!sourceMode) editor.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
  }, [editor, sourceMode, value]);
  useEffect(() => { if (autoFocus && !disabled) editor?.commands.focus(); }, [autoFocus, disabled, editor]);
  useEffect(() => () => { uploadController.current?.abort(); remoteImportController.current?.abort(); }, []);

  const active = (name, attrs) => { void revision; return !sourceMode && Boolean(editor?.isActive(name, attrs)); };
  const sourceRange = () => ({ start: sourceRef.current?.selectionStart ?? sourceValueRef.current.length, end: sourceRef.current?.selectionEnd ?? sourceValueRef.current.length });
  const replaceRange = (start, end, replacement, selectStart, selectEnd) => {
    const current = sourceValueRef.current;
    publish(`${current.slice(0, start)}${replacement}${current.slice(end)}`);
    queueMicrotask(() => { sourceRef.current?.focus(); sourceRef.current?.setSelectionRange(selectStart ?? start + replacement.length, selectEnd ?? selectStart ?? start + replacement.length); });
  };
  const wrapSource = (before, after, fallback) => { const { start, end } = sourceRange(); const selected = sourceValueRef.current.slice(start, end) || fallback; replaceRange(start, end, `${before}${selected}${after}`, start + before.length, start + before.length + selected.length); };
  const prefixLines = (prefix, stripHeading = false) => { const { start, end } = sourceRange(); const current = sourceValueRef.current; const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1; const nextBreak = current.indexOf('\n', end); const lineEnd = nextBreak < 0 ? current.length : nextBreak; const output = current.slice(lineStart, lineEnd).split('\n').map((line, index) => `${prefix(index)}${stripHeading ? line.replace(/^#{1,6}\s+/, '') : line}`).join('\n'); replaceRange(lineStart, lineEnd, output, lineStart, lineStart + output.length); };
  const command = (name) => {
    if (!editable) return;
    if (sourceMode) { if (name === 'toggleBulletList') prefixLines(() => '- '); else if (name === 'toggleOrderedList') prefixLines((index) => `${index + 1}. `); else if (name === 'toggleBlockquote') prefixLines(() => '> '); return; }
    const chain = editor?.chain().focus(); if (chain && typeof chain[name] === 'function') chain[name]().run();
  };
  const mark = (name) => { if (sourceMode) { const values = { bold: ['**', '**', tr('bold text', '粗体文字')], italic: ['_', '_', tr('italic text', '斜体文字')], strike: ['~~', '~~', tr('struck text', '删除文字')], code: ['`', '`', tr('code', '代码')] }; wrapSource(...values[name]); } else command(`toggle${name[0].toUpperCase()}${name.slice(1)}`); };
  const toggleSource = () => { if (!editor) return; if (!sourceMode) { const markdown = editor.getMarkdown(); sourceValueRef.current = markdown; setSourceValue(markdown); setSourceMode(true); } else if (requiresSourceMode(sourceValueRef.current)) onWarning(tr('Remove unsupported Markdown features before switching to visual editing.', '请先移除当前不支持的 Markdown 语法，再切换到可视化编辑。')); else { editor.commands.setContent(sourceValueRef.current || '', { contentType: 'markdown', emitUpdate: false }); setSourceMode(false); editor.commands.focus(); } };
  const applyLink = (override) => { if (!editable || !editor) return; const href = (typeof override === 'string' ? override : linkDraft).trim(); if (sourceMode) { const { start, end } = sourceRange(); const selected = sourceValueRef.current.slice(start, end) || tr('link text', '链接文字'); replaceRange(start, end, href ? `[${selected}](${href})` : selected); } else { const chain = editor.chain().focus().extendMarkRange('link'); href ? chain.setLink({ href }).run() : chain.unsetLink().run(); } setLinkOpen(false); };
  const cancelUpload = () => { const controller = uploadController.current; if (!controller) return; controller.abort(); callbacks.current.onUploadCancel(uploadingFiles.current); };
  const protectedFeatures = sourceMode ? findUnsupportedMarkdown(sourceValue) : [];
  const minHeight = fill ? '640px' : `${Math.max(420, rows * 32)}px`;
  const characterCount = sourceMode ? sourceValue.length : (editor?.getText()?.length || 0);

  return <div className={cx('nono-rich-editor', fill && 'nono-rich-editor--fill', disabled && 'is-disabled', readOnly && 'is-readonly')}>
    <div className={cx('nono-rich-editor__shell', focused && 'is-focused')}>
      {editor && <div className="nono-rich-editor__toolbar" role="toolbar" aria-label={tr('Formatting tools', '格式工具')}>
        <div className="nono-rich-editor__group"><button type="button" className="nono-rich-editor__button" disabled={!editable || sourceMode || !editor.can().undo()} onClick={() => command('undo')}>↶ <span>{tr('Undo', '撤销')}</span></button><button type="button" className="nono-rich-editor__button" disabled={!editable || sourceMode || !editor.can().redo()} onClick={() => command('redo')}>↷ <span>{tr('Redo', '重做')}</span></button></div>
        <div className="nono-rich-editor__group"><select className="nono-rich-editor__select" disabled={!editable} aria-label={tr('Text style', '文字样式')} value={active('heading', { level: 2 }) ? '2' : active('heading', { level: 3 }) ? '3' : active('heading', { level: 4 }) ? '4' : 'p'} onChange={(event) => sourceMode ? prefixLines(() => event.target.value === 'p' ? '' : `${'#'.repeat(Number(event.target.value))} `, true) : event.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) }).run()}><option value="p">{tr('Paragraph', '正文')}</option><option value="2">{tr('Heading 2', '标题 2')}</option><option value="3">{tr('Heading 3', '标题 3')}</option><option value="4">{tr('Heading 4', '标题 4')}</option></select></div>
        <div className="nono-rich-editor__group">{[['bold', 'B', 'Bold', '粗体'], ['italic', 'I', 'Italic', '斜体'], ['strike', 'S', 'Strikethrough', '删除线']].map(([name, label, en, zh]) => <button key={name} type="button" className={cx('nono-rich-editor__icon', `is-${name}`, active(name) && 'is-active')} disabled={!editable} title={tr(en, zh)} onClick={() => mark(name)}>{label}</button>)}</div>
        <div className="nono-rich-editor__group"><button type="button" className="nono-rich-editor__button" disabled={!editable} onClick={() => sourceMode ? insertSourceBlock('| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |') : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ <span>{tr('Table', '表格')}</span></button></div>
        <div className="nono-rich-editor__group"><button type="button" className="nono-rich-editor__icon" disabled={!editable} onClick={() => command('toggleBulletList')}>•</button><button type="button" className="nono-rich-editor__icon is-small" disabled={!editable} onClick={() => command('toggleOrderedList')}>1.</button><button type="button" className="nono-rich-editor__icon" disabled={!editable} onClick={() => command('toggleBlockquote')}>“</button><button type="button" className="nono-rich-editor__icon is-code" disabled={!editable} onClick={() => mark('code')}>&lt;/&gt;</button></div>
        <div className="nono-rich-editor__group nono-rich-editor__group--menu"><button type="button" className={cx('nono-rich-editor__button', (active('link') || linkOpen) && 'is-active')} disabled={!editable} onClick={() => { setLinkDraft(sourceMode ? '' : (editor.getAttributes('link').href || '')); setLinkOpen(true); }}>↗ <span>{tr('Link', '链接')}</span></button>{linkOpen && <div className="nono-rich-editor__link-panel"><label><span>{tr('Link URL', '链接地址')}</span><input aria-label={tr('Link URL', '链接地址')} value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyLink(); if (event.key === 'Escape') setLinkOpen(false); }} /></label><div><button type="button" onClick={() => applyLink()}>{tr('Apply', '应用')}</button><button type="button" className="is-danger" onClick={() => applyLink('')}>{tr('Remove', '移除')}</button></div></div>}{uploadImages && <label className={cx('nono-rich-editor__button', 'nono-rich-editor__upload', uploading && 'is-disabled')}>↑ <span>{uploading ? tr('Uploading...', '上传中...') : tr('Upload', '上传')}</span><input type="file" accept={imageAccept} disabled={!editable || uploading} multiple onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ''; }} /></label>}</div>
        <div className="nono-rich-editor__group"><button type="button" className={cx('nono-rich-editor__button', sourceMode && 'is-active')} disabled={disabled} onClick={toggleSource}>MD <span>{sourceMode ? tr('Visual', '可视化') : tr('Source', '源码')}</span></button></div>
        {toolbarEnd}
      </div>}
      {protectedFeatures.length > 0 && <div className="nono-rich-editor__notice" role="status">{tr('This content stays in source mode to prevent formatting loss.', '此内容包含暂不支持的语法。为避免格式丢失，已保留在源码模式。')}</div>}
      {uploadStatus && <div className="nono-rich-editor__upload-status"><div><strong>{uploadStatus.name}</strong><span className="nono-rich-editor__upload-summary"><span className={`is-${uploadStatus.status}`}>{uploadStatus.status === 'uploading' ? `${uploadStatus.progress}%` : uploadStatus.status}</span>{uploadStatus.status === 'uploading' && <button type="button" title={tr('Cancel upload', '取消上传')} onClick={cancelUpload}>{tr('Cancel', '取消')}</button>}</span></div><div className="nono-rich-editor__progress"><i className={`is-${uploadStatus.status}`} style={{ width: `${uploadStatus.progress}%` }} /></div>{uploadStatus.error && <p>{uploadStatus.error}</p>}</div>}
      {sourceMode ? <textarea ref={sourceRef} value={sourceValue} disabled={disabled} readOnly={readOnly} placeholder={placeholder} className="nono-rich-editor__source" style={{ '--nono-editor-min-height': minHeight }} spellCheck="false" onChange={(event) => publish(event.target.value)} onPaste={(event) => { const files = event.clipboardData?.files; if (files?.length) { event.preventDefault(); void uploadFiles(files); return; } const { start, end } = sourceRange(); handleRemotePaste(event, (content) => replaceRange(start, end, content)); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /> : <EditorContent editor={editor} className="nono-rich-editor__content" style={{ '--nono-editor-min-height': minHeight }} />}
      {editor && <div className="nono-rich-editor__footer"><span>{tr('{count} characters', '{count} 个字符', { count: characterCount })}</span><span className="nono-rich-editor__footer-meta">{footerStatus}<span>{sourceMode ? tr('Markdown source', 'Markdown 源码') : tr('Markdown compatible', '兼容 Markdown')}</span></span></div>}
    </div>{help && <p className="nono-rich-editor__help">{help}</p>}
  </div>;
}

export default NonoEditor;
