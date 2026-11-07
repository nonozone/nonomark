import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { CaptionImage, imageMarkdown, imageMarkdownFeatures, requiresImageSourceMode, imageToolsPosition } from '../../vue/src/imageProperties.js';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { Placeholder } from '@tiptap/extensions';
import { findRemoteImageReferences, importRemoteImagesFromContent } from '@nonoim/editor-core';
import { buildGalleryMarkdown } from '../../vue/src/gallery.js';

const DEFAULT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
const cx = (...values) => values.filter(Boolean).join(' ');
const selectImageOnMouseDown = (view, event) => { const target = event.target; if (target?.tagName !== 'IMG' || !view.editable) return false; const position = view.posAtDOM(target, 0); if (view.state.doc.nodeAt(position)?.type.name !== 'image') return false; view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position))); view.focus(); event.preventDefault(); return true; };

export function NonoEditor({
  value = '', onChange = () => {}, placeholder = '', rows = 10, help = '', fill = false,
  disabled = false, readOnly = false, autoFocus = false, allowBase64Images = false,
  locale = 'en', uploadImages = null, importRemoteImages = null, imageAccept = DEFAULT_IMAGE_ACCEPT,
  maxImageSize = 10 * 1024 * 1024, autoSourceMode = false, onWarning = () => {}, onUploadComplete = () => {},
  onUploadError = () => {}, onUploadCancel = () => {}, onRemoteImageImportStart = () => {},
  onRemoteImageImportComplete = () => {}, onRemoteImageImportError = () => {}, enableGallery = true,
  onGalleryPickImage = () => {}, toolbarEnd = null, footerStatus = null,
}) {
  const tr = useCallback((en, zh, vars) => {
    let text = /^zh(?:-|$)/i.test(locale) ? (zh || en) : en;
    return vars ? text.replace(/\{(\w+)\}/g, (_match, key) => vars[key] == null ? '' : String(vars[key])) : text;
  }, [locale]);
  const editable = !disabled && !readOnly;
  const [toolbarMoreOpen, setToolbarMoreOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(() => autoSourceMode && requiresImageSourceMode(value));
  const [sourceValue, setSourceValue] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryPickerId, setGalleryPickerId] = useState(null);
  const [galleryError, setGalleryError] = useState('');
  const [galleryUploading, setGalleryUploading] = useState(false);
  const gallerySequence = useRef(0);
  const galleryFileInput = useRef(null);
  const galleryUploadTarget = useRef(null);
  const closeToolbarMore = () => { setToolbarMoreOpen(false); setLinkOpen(false); };
  const [linkDraft, setLinkDraft] = useState('');
  const [imagePropertiesOpen, setImagePropertiesOpen] = useState(false);
  const [imageAltDraft, setImageAltDraft] = useState('');
  const [imageCaptionDraft, setImageCaptionDraft] = useState('');
  const [imageToolsStyle, setImageToolsStyle] = useState({});
  const imageSurface = useRef(null), imagePanel = useRef(null), imageAltInput = useRef(null), imageTarget = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const sourceRef = useRef(null);
  const sourceValueRef = useRef(sourceValue);
  const editorRef = useRef(null);
  const uploadController = useRef(null);
  const remoteImportController = useRef(null);
  const uploadingFiles = useRef([]);
  const lastPublished = useRef(null);
  const callbacks = useRef({ onChange, onUploadComplete, onUploadError, onUploadCancel, onRemoteImageImportStart, onRemoteImageImportComplete, onRemoteImageImportError, onGalleryPickImage });
  callbacks.current = { onChange, onUploadComplete, onUploadError, onUploadCancel, onRemoteImageImportStart, onRemoteImageImportComplete, onRemoteImageImportError, onGalleryPickImage };
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
      insertSourceBlock(images.map(image => imageMarkdown(image)).join('\n\n'));
      return;
    }
    const nodes = images.flatMap(({ url, alt, title }) => [{ type: 'image', attrs: { src: url, alt: alt ?? '', title: title ?? null } }, { type: 'paragraph' }]);
    if (nodes.length) editorRef.current?.chain().focus().insertContent(nodes).run();
  }, [insertSourceBlock, sourceMode]);

  const newGalleryItem = () => ({ id: `gallery-${++gallerySequence.current}`, url: '', alt: '', title: '', caption: '' });
  const openGallery = () => { if (!editable || !enableGallery || galleryOpen) return; setGalleryError(''); setGalleryPickerId(null); setGalleryItems([newGalleryItem(), newGalleryItem()]); setGalleryOpen(true); };
  const closeGallery = () => { if (!galleryUploading) { setGalleryOpen(false); setGalleryPickerId(null); setGalleryError(''); } };
  const setGalleryColumns = (count) => setGalleryItems((items) => { const next = items.slice(); while (next.length < count) next.push(newGalleryItem()); while (next.length > count) next.pop(); return next; });
  const updateGalleryItem = (id, patch) => setGalleryItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const pickGalleryImage = (itemId) => { setGalleryPickerId(itemId); callbacks.current.onGalleryPickImage({ itemId, onSelect: (asset) => { if (!asset?.url) return; updateGalleryItem(itemId, { url: asset.url, alt: asset.alt ?? '', title: asset.title ?? '' }); setGalleryPickerId(null); setGalleryError(''); } }); };
  const moveGalleryItem = (index, delta) => setGalleryItems((items) => { const next = index + delta; if (next < 0 || next >= items.length) return items; const values = items.slice(); [values[index], values[next]] = [values[next], values[index]]; return values; });
  const removeGalleryItem = (index) => setGalleryItems((items) => items.length <= 2 ? items : items.filter((_item, itemIndex) => itemIndex !== index));
  const openGalleryUpload = (itemId) => { galleryUploadTarget.current = itemId; galleryFileInput.current?.click(); };
  const handleGalleryUpload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    const target = galleryUploadTarget.current; galleryUploadTarget.current = null;
    if (!file || !target || !uploadImages) return;
    const message = (!new Set(imageAccept.split(',').map((item) => item.trim())).has(file.type) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || ''))
      ? tr('Unsupported image format.', '不支持该图片格式。') : file.size > maxImageSize ? tr('File exceeds the size limit.', '图片超过大小限制。') : '';
    if (message) { setGalleryError(message); return; }
    setGalleryUploading(true); setGalleryError('');
    try {
      const result = await uploadImages([file], { signal: new AbortController().signal, onProgress: () => {}, file });
      const asset = Array.isArray(result) ? result.find((entry) => entry?.url) : null;
      if (!asset) throw new Error(tr('The upload returned no image URL.', '上传结果中没有可用的图片地址。'));
      updateGalleryItem(target, { url: asset.url, alt: asset.alt ?? '', title: asset.title ?? '' });
    } catch (error) { setGalleryError(error?.message || String(error)); } finally { setGalleryUploading(false); }
  };
  const insertGallery = () => {
    if (!editable || galleryItems.length < 2 || galleryItems.length > 4 || galleryItems.some((item) => !item.url)) return;
    try {
      const markdown = buildGalleryMarkdown(galleryItems);
      if (sourceMode) insertSourceBlock(markdown);
      else {
        const imageNodes = galleryItems.map(({ url, alt, title, caption }) => editor.schema.nodes.image.create({ src: String(url).trim(), alt: String(alt ?? ''), title: title ?? null, caption: caption || null }));
        const content = editor.schema.nodes.imageGallery.create(null, imageNodes);
        editor.view.dispatch(closeHistory(editor.state.tr));
        if (!editor.commands.insertContentAt(editor.state.selection, content)) throw new Error(tr('The gallery could not be inserted at the current selection.', '图册无法插入当前光标位置。'));
        editor.commands.focus();
      }
      closeGallery();
    } catch (error) { setGalleryError(error?.message || String(error)); }
  };

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
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }), CaptionImage.configure({ allowBase64: allowBase64Images }), TableKit, Placeholder.configure({ placeholder: placeholder || tr('Start writing...', '开始输入正文…') }), Markdown],
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
    if (autoSourceMode && requiresImageSourceMode(value)) setSourceMode(true);
    else if (!sourceMode) editor.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
  }, [autoSourceMode, editor, sourceMode, value]);
  useEffect(() => { if (autoFocus && !disabled) editor?.commands.focus(); }, [autoFocus, disabled, editor]);
  useEffect(() => () => { uploadController.current?.abort(); remoteImportController.current?.abort(); }, []);

  const selection = editor?.state.selection;
  const selectedImage = !sourceMode && selection instanceof NodeSelection && selection.node.type.name === 'image'
    ? { pos: selection.from, ...selection.node.attrs } : null;
  const closeImageProperties = useCallback(() => { imageTarget.current = null; setImagePropertiesOpen(false); }, []);
  useEffect(() => {
    const target = imageTarget.current;
    if (!editable || (target && (!selectedImage || selectedImage.pos !== target.pos || selectedImage.src !== target.src))) closeImageProperties();
    const updatePosition = () => {
      const surface = imageSurface.current, node = selectedImage && editor?.view.nodeDOM(selectedImage.pos);
      if (surface && node?.getBoundingClientRect) setImageToolsStyle(imageToolsPosition(surface, node, imagePanel.current?.parentElement.offsetHeight || 44));
    };
    updatePosition();
    const outside = event => { if (!imagePanel.current?.contains(event.target) && !imageSurface.current?.querySelector('.nono-rich-editor__image-properties-button')?.contains(event.target)) closeImageProperties(); };
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    document.addEventListener('pointerdown', outside);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null;
    if (imageSurface.current) observer?.observe(imageSurface.current);
    const content = imageSurface.current?.querySelector('.ProseMirror');
    if (content) observer?.observe(content);
    return () => { window.removeEventListener('resize', updatePosition); document.removeEventListener('scroll', updatePosition, true); window.visualViewport?.removeEventListener('resize', updatePosition); document.removeEventListener('pointerdown', outside); observer?.disconnect(); };
  }, [editor, editable, sourceMode, revision, imagePropertiesOpen, selectedImage?.pos, selectedImage?.src, closeImageProperties]);
  useEffect(() => { if (imagePropertiesOpen) imageAltInput.current?.focus({ preventScroll: true }); }, [imagePropertiesOpen]);
  const openImageProperties = () => {
    if (!selectedImage || !editable || imagePropertiesOpen) return;
    imageTarget.current = { pos: selectedImage.pos, src: selectedImage.src };
    setImageAltDraft(selectedImage.alt || ''); setImageCaptionDraft(selectedImage.caption || ''); setImagePropertiesOpen(true);
  };
  const applyImageProperties = event => {
    event.preventDefault();
    const target = imageTarget.current, node = target && editor?.state.doc.nodeAt(target.pos);
    if (!editable || sourceMode || !target || node?.type.name !== 'image' || node.attrs.src !== target.src) { closeImageProperties(); return; }
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(target.pos, undefined, { ...node.attrs, alt: imageAltDraft, caption: imageCaptionDraft || null }));
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.commands.focus(undefined, { scrollIntoView: false }); closeImageProperties();
  };

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
  const toggleSource = () => { if (!editor) return; closeImageProperties(); if (!sourceMode) { const markdown = editor.getMarkdown(); sourceValueRef.current = markdown; setSourceValue(markdown); setSourceMode(true); } else if (requiresImageSourceMode(sourceValueRef.current)) onWarning(tr('Remove unsupported Markdown features before switching to visual editing.', '请先移除当前不支持的 Markdown 语法，再切换到可视化编辑。')); else { editor.commands.setContent(sourceValueRef.current || '', { contentType: 'markdown', emitUpdate: false }); setSourceMode(false); editor.commands.focus(); } };
  const applyLink = (override) => { if (!editable || !editor) return; const href = (typeof override === 'string' ? override : linkDraft).trim(); if (sourceMode) { const { start, end } = sourceRange(); const selected = sourceValueRef.current.slice(start, end) || tr('link text', '链接文字'); replaceRange(start, end, href ? `[${selected}](${href})` : selected); } else { const chain = editor.chain().focus().extendMarkRange('link'); href ? chain.setLink({ href }).run() : chain.unsetLink().run(); } setLinkOpen(false); };
  const cancelUpload = () => { const controller = uploadController.current; if (!controller) return; controller.abort(); callbacks.current.onUploadCancel(uploadingFiles.current); };
  const protectedFeatures = sourceMode ? imageMarkdownFeatures(sourceValue) : [];
  const minHeight = fill ? '640px' : `${Math.max(420, rows * 32)}px`;
  const characterCount = sourceMode ? sourceValue.length : (editor?.getText()?.length || 0);

  return <div className={cx('nono-rich-editor', fill && 'nono-rich-editor--fill', disabled && 'is-disabled', readOnly && 'is-readonly')} onKeyDown={event => { if (event.key === 'Escape') { closeToolbarMore(); closeGallery(); } }}>
    <div className={cx('nono-rich-editor__shell', focused && 'is-focused')}>
      {editor && <div className={cx('nono-rich-editor__toolbar', toolbarMoreOpen && 'is-expanded')} role="toolbar" aria-label={tr('Formatting tools', '格式工具')}>
        <div className="nono-rich-editor__group">
          <button type="button" className="nono-rich-editor__button" disabled={!editable || sourceMode || !editor.can().undo()} title={tr('Undo', '撤销')} onClick={() => command('undo')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.5h7a3.5 3.5 0 0 1 3.5 3.5v0a3.5 3.5 0 0 1-3.5 3.5H6" /><path d="M6.5 4L4 6.5l2.5 2.5" /></svg>
            <span className="nono-rich-editor__label">{tr('Undo', '撤销')}</span>
          </button>
          <button type="button" className="nono-rich-editor__button" disabled={!editable || sourceMode || !editor.can().redo()} title={tr('Redo', '重做')} onClick={() => command('redo')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M12 6.5H5a3.5 3.5 0 0 0-3.5 3.5v0A3.5 3.5 0 0 0 5 13.5h5" /><path d="M9.5 4l2.5 2.5-2.5 2.5" /></svg>
            <span className="nono-rich-editor__label">{tr('Redo', '重做')}</span>
          </button>
        </div>
        <div className="nono-rich-editor__group nono-rich-editor__secondary-tool"><select className="nono-rich-editor__select" disabled={!editable} aria-label={tr('Text style', '文字样式')} value={active('heading', { level: 2 }) ? '2' : active('heading', { level: 3 }) ? '3' : active('heading', { level: 4 }) ? '4' : 'p'} onChange={(event) => sourceMode ? prefixLines(() => event.target.value === 'p' ? '' : `${'#'.repeat(Number(event.target.value))} `, true) : event.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) }).run()}><option value="p">{tr('Paragraph', '正文')}</option><option value="2">{tr('Heading 2', '标题 2')}</option><option value="3">{tr('Heading 3', '标题 3')}</option><option value="4">{tr('Heading 4', '标题 4')}</option></select></div>
        <div className="nono-rich-editor__group">{[['bold', 'B', 'Bold', '粗体'], ['italic', 'I', 'Italic', '斜体'], ['strike', 'S', 'Strikethrough', '删除线']].map(([name, label, en, zh]) => <button key={name} type="button" className={cx('nono-rich-editor__icon', `is-${name}`, name === 'strike' && 'nono-rich-editor__secondary-tool', active(name) && 'is-active')} disabled={!editable} title={tr(en, zh)} onClick={() => mark(name)}>{label}</button>)}</div>
        <div className="nono-rich-editor__group nono-rich-editor__secondary-tool">
          <button type="button" className="nono-rich-editor__button" disabled={!editable} title={tr('Table', '表格')} onClick={() => sourceMode ? insertSourceBlock('| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |') : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M2 10.5h12M6 2.5v11M10 2.5v11" /></svg>
            <span className="nono-rich-editor__label">{tr('Table', '表格')}</span>
          </button>
        </div>
        <div className="nono-rich-editor__group nono-rich-editor__secondary-tool">
          <button type="button" className="nono-rich-editor__icon" disabled={!editable} title={tr('Bullet list', '项目列表')} onClick={() => command('toggleBulletList')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 4h7M6.5 8h7M6.5 12h7" /><circle cx="3" cy="4" r="1.2" fill="currentColor" stroke="none" /><circle cx="3" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none" /></svg>
          </button>
          <button type="button" className="nono-rich-editor__icon" disabled={!editable} title={tr('Numbered list', '编号列表')} onClick={() => command('toggleOrderedList')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 4h6.5M7 8h6.5M7 12h6.5" /><path d="M2.5 2.5l1-.5v3.5M2 5.5h2" strokeWidth="1.3" /><path d="M2 8.2a1 1 0 0 1 1-1h.2a1 1 0 0 1 1 1c0 .6-.7 1-1.7 1.6h1.7" strokeWidth="1.2" /><path d="M2 11.7h1.5a.8.8 0 0 1 .7.8c0 .5-.4.8-.8.8h-.4.4c.5 0 .8.4.8.8a.8.8 0 0 1-.8.8H2" strokeWidth="1.2" /></svg>
          </button>
          <button type="button" className="nono-rich-editor__icon" disabled={!editable} title={tr('Quote', '引用')} onClick={() => command('toggleBlockquote')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 9.5c0-1.8 1-3.2 2.6-3.8V4.3C3.5 5 2 7 2 9.5h3.2v4H2v-4h1.2zm6.2 0c0-1.8 1-3.2 2.6-3.8V4.3C9.7 5 8.2 7 8.2 9.5h3.2v4H8.2v-4h1.2z" fill="currentColor" stroke="none" /></svg>
          </button>
          <button type="button" className="nono-rich-editor__icon is-code" disabled={!editable} title={tr('Inline code', '行内代码')} onClick={() => mark('code')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5L2 8l3 3M11 5l3 3-3 3M9.5 3.5l-3 9" /></svg>
          </button>
        </div>
        <div className="nono-rich-editor__group nono-rich-editor__group--menu">
          <button type="button" className={cx('nono-rich-editor__button', (active('link') || linkOpen) && 'is-active')} disabled={!editable} title={tr('Link', '链接')} onClick={() => { setLinkDraft(sourceMode ? '' : (editor.getAttributes('link').href || '')); setLinkOpen(true); }}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7 4M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5L9 12" /></svg>
            <span className="nono-rich-editor__label">{tr('Link', '链接')}</span>
          </button>
          {linkOpen && <div className="nono-rich-editor__link-panel"><label><span>{tr('Link URL', '链接地址')}</span><input aria-label={tr('Link URL', '链接地址')} value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyLink(); if (event.key === 'Escape') setLinkOpen(false); }} /></label><div><button type="button" onClick={() => applyLink()}>{tr('Apply', '应用')}</button><button type="button" className="is-danger" onClick={() => applyLink('')}>{tr('Remove', '移除')}</button></div></div>}
          {uploadImages && <label className={cx('nono-rich-editor__button', 'nono-rich-editor__upload', 'nono-rich-editor__secondary-tool', uploading && 'is-disabled')} title={tr('Upload image', '上传图片')}>
            <svg className="nono-rich-editor__svg-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M8 10.5V5.5m0 0l-2 2m2-2l2 2M5 11.5h6" /></svg>
            <span className="nono-rich-editor__label">{uploading ? tr('Uploading...', '上传中...') : tr('Upload', '上传')}</span>
            <input type="file" accept={imageAccept} disabled={!editable || uploading} multiple onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ''; }} />
          </label>}
          {enableGallery && <button type="button" className={cx('nono-rich-editor__button', 'nono-rich-editor__secondary-tool')} disabled={!editable} title={tr('Gallery', '图册')} onMouseDown={(event) => { event.preventDefault(); openGallery(); }} onClick={openGallery}>
            <svg className="nono-rich-editor__svg-icon nono-rich-editor__gallery-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="5.2" height="5.2" rx="1" /><rect x="8.8" y="2.5" width="5.2" height="5.2" rx="1" /><rect x="2" y="8.8" width="5.2" height="5.2" rx="1" /><rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1" /></svg>
            <span className="nono-rich-editor__label">{tr('Gallery', '图册')}</span>
          </button>}
        </div>
        <div className="nono-rich-editor__group">
          <button type="button" className={cx('nono-rich-editor__button', 'nono-rich-editor__source-toggle', 'is-labeled', sourceMode && 'is-active')} disabled={disabled} title={sourceMode ? tr('Switch to visual editor', '切换为可视化编辑') : tr('Switch to Markdown source', '切换为 Markdown 源码')} onClick={toggleSource}>
            <span className="nono-rich-editor__source-badge">MD</span>
            <span>{sourceMode ? tr('Visual', '可视化') : tr('Source', '源码')}</span>
          </button>
        </div>
        <div className="nono-rich-editor__host-tools nono-rich-editor__secondary-tool">{toolbarEnd}</div>
        <button type="button" className="nono-rich-editor__button nono-rich-editor__toolbar-more" aria-label={tr('More tools', '更多工具')} aria-expanded={toolbarMoreOpen} onMouseDown={event => event.preventDefault()} onClick={() => toolbarMoreOpen ? closeToolbarMore() : setToolbarMoreOpen(true)}>{toolbarMoreOpen ? tr('Less', '收起') : tr('More', '更多')}</button>
      </div>}
      {protectedFeatures.length > 0 && <div className="nono-rich-editor__notice" role="status">{tr('This content stays in source mode to prevent formatting loss.', '此内容包含暂不支持的语法。为避免格式丢失，已保留在源码模式。')}</div>}
      {uploadStatus && <div className="nono-rich-editor__upload-status"><div><strong>{uploadStatus.name}</strong><span className="nono-rich-editor__upload-summary"><span className={`is-${uploadStatus.status}`}>{uploadStatus.status === 'uploading' ? `${uploadStatus.progress}%` : uploadStatus.status}</span>{uploadStatus.status === 'uploading' && <button type="button" title={tr('Cancel upload', '取消上传')} onClick={cancelUpload}>{tr('Cancel', '取消')}</button>}</span></div><div className="nono-rich-editor__progress"><i className={`is-${uploadStatus.status}`} style={{ width: `${uploadStatus.progress}%` }} /></div>{uploadStatus.error && <p>{uploadStatus.error}</p>}</div>}
      {sourceMode ? <textarea ref={sourceRef} value={sourceValue} disabled={disabled} readOnly={readOnly} placeholder={placeholder} className="nono-rich-editor__source" style={{ '--nono-editor-min-height': minHeight }} spellCheck="false" onChange={(event) => publish(event.target.value)} onPaste={(event) => { const files = event.clipboardData?.files; if (files?.length) { event.preventDefault(); void uploadFiles(files); return; } const { start, end } = sourceRange(); handleRemotePaste(event, (content) => replaceRange(start, end, content)); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /> : <div ref={imageSurface} className="nono-rich-editor__image-surface" onKeyDown={event => { if (event.key === 'Escape') closeImageProperties(); }}>
        <EditorContent editor={editor} className="nono-rich-editor__content" style={{ '--nono-editor-min-height': minHeight }} />
        {selectedImage && editable && <div className="nono-rich-editor__image-tools" style={imageToolsStyle}>
          <button type="button" className="nono-rich-editor__image-properties-button" aria-expanded={imagePropertiesOpen} onMouseDown={event => event.preventDefault()} onClick={openImageProperties}>{tr('Image properties', '图片属性')}</button>
          {imagePropertiesOpen && <form ref={imagePanel} className="nono-rich-editor__image-properties" role="dialog" aria-label={tr('Image properties', '图片属性')} onSubmit={applyImageProperties}>
            <label>{tr('Alternative text (alt)', '锚文本 alt')}<input ref={imageAltInput} aria-label={tr('Alternative text (alt)', '锚文本 alt')} value={imageAltDraft} onChange={event => setImageAltDraft(event.target.value)} /></label>
            <p>{tr('Describe the image for people who cannot see it. This text is not a visible caption.', '描述图片内容，供无法看到图片的人使用。它不会作为图片说明显示。')}</p>
            <label>{tr('Caption (optional)', '图片说明（可选）')}<input aria-label={tr('Caption (optional)', '图片说明（可选）')} value={imageCaptionDraft} onChange={event => setImageCaptionDraft(event.target.value)} /></label>
            <p>{tr('Shown below this image in the article.', '填写后显示在文章的图片下方。')}</p>
            <div className="nono-rich-editor__image-properties-actions">{imageCaptionDraft && <button type="button" onClick={() => setImageAltDraft(imageCaptionDraft)}>{tr('Use caption as alt', '一键替换ALT')}</button>}<button type="button" onClick={closeImageProperties}>{tr('Cancel', '取消')}</button><button type="submit">{tr('Apply', '应用')}</button></div>
          </form>}
        </div>}
      </div>}
      {editor && <div className="nono-rich-editor__footer"><span>{tr('{count} characters', '{count} 个字符', { count: characterCount })}</span><span className="nono-rich-editor__footer-meta">{footerStatus}<span>{sourceMode ? tr('Markdown source', 'Markdown 源码') : tr('Markdown compatible', '兼容 Markdown')}</span></span></div>}
    </div>{help && <p className="nono-rich-editor__help">{help}</p>}
    {galleryOpen && <div className="nono-rich-editor__gallery-overlay" onKeyDown={(event) => { if (event.key === 'Escape') closeGallery(); }}>
      <section role="dialog" aria-modal="true" aria-label={tr('Insert gallery', '插入图册')} className="nono-rich-editor__gallery-dialog">
        <h2>{tr('Insert gallery', '插入图册')}</h2>
        <fieldset><legend>{tr('Images', '图片数量')}</legend>{[2, 3, 4].map((count) => <label key={count}><input type="radio" name="nono-gallery-columns" value={count} checked={galleryItems.length === count} onChange={() => setGalleryColumns(count)} />{tr('{count} images', '{count} 张图片', { count })}</label>)}</fieldset>
        <p className="nono-rich-editor__gallery-layout-hint">{tr('{count} images will appear in one row in the article on desktop; phones use a single column. The picker cards below are only for choosing images.', '{count} 张图片将在桌面正文中并排一行显示；手机单列显示。下方选择卡片的布局不代表正文排版。', { count: galleryItems.length })}</p>
        <div className="nono-rich-editor__gallery-items">{galleryItems.map((item, index) => <div key={item.id} className="nono-rich-editor__gallery-item">
          <div className="nono-rich-editor__gallery-preview">{item.url ? <img src={item.url} alt={item.alt} /> : <span>{tr('No image selected', '尚未选择图片')}</span>}</div>
          <div className="nono-rich-editor__gallery-item-actions"><button type="button" onClick={() => pickGalleryImage(item.id)}>{tr('Choose image', '选择图片')}</button>{uploadImages && <button type="button" disabled={galleryUploading} onClick={() => openGalleryUpload(item.id)}>{tr('Upload image', '上传图片')}</button>}<button type="button" disabled={index === 0} aria-label={tr('Move left', '左移')} onClick={() => moveGalleryItem(index, -1)}>←</button><button type="button" disabled={index === galleryItems.length - 1} aria-label={tr('Move right', '右移')} onClick={() => moveGalleryItem(index, 1)}>→</button><button type="button" disabled={galleryItems.length <= 2} aria-label={tr('Remove image', '删除图片')} onClick={() => removeGalleryItem(index)}>×</button></div>
          <input value={item.caption} aria-label={tr('Caption for image {count}', '第 {count} 张图的图片说明（可选）', { count: index + 1 })} placeholder={tr('Image caption (optional)', '图片说明（可选）')} onChange={(event) => updateGalleryItem(item.id, { caption: event.target.value })} />
          <input value={item.alt} aria-label={tr('Alternative text for image {count}', '第 {count} 张图的锚文本 alt', { count: index + 1 })} placeholder={tr('Alternative text (alt)', '锚文本 alt')} onChange={(event) => updateGalleryItem(item.id, { alt: event.target.value })} />
        </div>)}</div>
        <input ref={galleryFileInput} className="nono-rich-editor__gallery-file" type="file" accept={imageAccept} onChange={handleGalleryUpload} />
        {galleryPickerId && <div className="nono-rich-editor__gallery-picker"><p>{tr('Choose an image from your media library.', '请从媒体库选择图片。')}</p></div>}
        {galleryError && <p role="alert" className="nono-rich-editor__gallery-error">{galleryError}</p>}
        <div className="nono-rich-editor__gallery-footer"><button type="button" onClick={closeGallery}>{tr('Cancel', '取消')}</button><button type="button" disabled={galleryItems.length < 2 || galleryItems.length > 4 || galleryItems.some((item) => !item.url) || galleryUploading} onClick={insertGallery}>{tr('Insert into document', '插入到正文')}</button></div>
      </section>
    </div>}
  </div>;
}

export default NonoEditor;
