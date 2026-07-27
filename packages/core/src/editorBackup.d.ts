export type MaybePromise<T> = T | Promise<T>;

export interface EditorBackupStorage {
  getItem(key: string): MaybePromise<string | null | undefined>;
  setItem(key: string, value: string): MaybePromise<unknown>;
  removeItem(key: string): MaybePromise<unknown>;
}

export type EditorBackupStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'scheduled'
  | 'saving'
  | 'saved'
  | 'restored'
  | 'discarded'
  | 'cleared'
  | 'error'
  | 'destroyed';

export type EditorBackupOperation = 'save' | 'discover' | 'clear' | 'discard';

export interface EditorBackupEntry<T = unknown> {
  version: 1;
  backupKey: string;
  savedAt: string;
  payload: T;
}

export interface EditorBackupStatusEvent<T = unknown> {
  type: 'status';
  status: EditorBackupStatus;
  backupKey: string;
  entry?: EditorBackupEntry<T>;
  operation?: EditorBackupOperation;
  error?: unknown;
}

export interface EditorBackupErrorEvent {
  type: 'error';
  operation: EditorBackupOperation;
  error: unknown;
  backupKey: string;
}

export type EditorBackupEvent<T = unknown> = EditorBackupStatusEvent<T> | EditorBackupErrorEvent;

export interface EditorBackupOptions<T = unknown> {
  backupKey: string;
  debounceMs?: number;
  storage?: EditorBackupStorage;
  prefix?: string;
  now?: () => number;
  onStatus?: (event: EditorBackupStatusEvent<T>) => void;
  onError?: (event: EditorBackupErrorEvent) => void;
}

export interface EditorBackupController<T = unknown> {
  readonly backupKey: string;
  readonly storageKey: string;
  readonly status: EditorBackupStatus;
  readonly error: unknown;
  readonly lastBackup: EditorBackupEntry<T> | null;
  subscribe(listener: (event: EditorBackupEvent<T>) => void): () => boolean;
  schedule(payload: T): void;
  save(payload: T): Promise<EditorBackupEntry<T>>;
  flush(): Promise<EditorBackupEntry<T> | null>;
  discover(): Promise<EditorBackupEntry<T> | null>;
  restore(): Promise<T | null>;
  clear(): Promise<void>;
  discard(): Promise<void>;
  destroy(): void;
}

export function createEditorBackup<T = unknown>(options: EditorBackupOptions<T>): EditorBackupController<T>;
