import type { ImageAsset, UploadImages } from './index.js';

export interface S3UploadRequest { uploadUrl: string; publicUrl: string; method?: string; headers?: HeadersInit; withCredentials?: boolean; timeout?: number; alt?: string; title?: string; id?: string; provider?: string; key?: string; }
export interface S3UploadPreparationContext { signal: AbortSignal; index: number; }
export interface S3UploadTransportRequest { uploadUrl: string; method: string; headers?: HeadersInit; file: File; signal: AbortSignal; onProgress: (loaded: number, total?: number) => void; withCredentials?: boolean; timeout?: number; }
export interface S3ImageUploaderOptions { provider?: string; getUploadRequest: (file: File, context: S3UploadPreparationContext) => Promise<S3UploadRequest> | S3UploadRequest; uploadRequest?: (request: S3UploadTransportRequest) => Promise<void>; }
export function uploadWithXhr(request: S3UploadTransportRequest): Promise<void>;
export function createS3ImageUploader(options: S3ImageUploaderOptions): UploadImages;
export type S3ImageAsset = ImageAsset;
