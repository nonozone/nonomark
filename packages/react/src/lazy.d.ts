import type { ReactNode } from 'react';
import type { NonoEditor, NonoEditorProps } from './index.js';

export interface NonoLazyEditorProps extends NonoEditorProps {
  fallback?: ReactNode;
}

export function NonoLazyEditor(props: NonoLazyEditorProps): ReactNode;
export const NonoLazyMarkdownEditor: typeof NonoLazyEditor;
export function preloadNonoEditor(): Promise<{ default: typeof NonoEditor; NonoEditor: typeof NonoEditor }>;
export default NonoLazyEditor;
