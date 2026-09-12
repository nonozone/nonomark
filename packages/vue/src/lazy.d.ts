import type { NonoEditor, NonoEditorProps } from './index.js';

export interface NonoLazyEditorProps extends NonoEditorProps {}

export const NonoLazyEditor: typeof NonoEditor;
export const NonoLazyMarkdownEditor: typeof NonoEditor;
export function preloadNonoEditor(): Promise<{ default: typeof NonoEditor }>;
export default NonoLazyEditor;
