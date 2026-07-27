# Changelog

All notable changes to this package are documented here. The project follows semantic versioning once a release is published.

## Unreleased

- Convert the repository to a private npm-workspaces monorepo with `apps/` and `packages/` boundaries.
- Add framework-independent `@nonoim/editor-core`.
- Add official `@nonoim/editor-vue` and `@nonoim/editor-react` packages with shared visual and upload behavior.
- Keep `@nonoim/editor` as a compatibility package for existing Vue projects.

## 0.2.0 - 2026-07-23

- Protect task lists, frontmatter, footnotes and raw HTML from lossy visual conversion.
- Add `disabled`, `readonly` and `autofocus` component states.
- Add inline link editing and paste/drop image uploads.
- Prevent concurrent upload batches.
- Add component integration tests, expanded Markdown round-trip tests and CI.
- Add a distraction-free local Playground with optional embedded data-URL images.
- Keep formatting, links, tables and image tools available in Markdown source mode.
- Add Markdown import/export, guarded new-document actions, autosave status, recoverable snapshots and storage-capacity warnings to the Playground.
- Add `toolbar-end` and `footer-status` host integration slots.
- Standardize provider-neutral image uploads with `AbortSignal`, byte progress, structured asset metadata and cancellation while preserving the previous progress callback.
- Export `createLocalImageUploader()` as the first standard provider for Base64/offline documents.
- Add the independent `@nonoim/editor/upload-s3` adapter for presigned PUT uploads to S3, Cloudflare R2, MinIO and compatible providers.
- Add an authenticated Cloudflare R2 Worker example with streamed uploads and public immutable image delivery.
