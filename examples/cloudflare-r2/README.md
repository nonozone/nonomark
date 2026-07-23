# Cloudflare R2 upload backend

This Worker is a secure host-side reference for `@nonoim/editor/upload-s3`. It uses the in-process R2 binding and streams image bodies into R2. It does not expose R2 credentials to the browser.

The example deliberately requires an `AUTH` service binding. That service must return a successful response only for an authenticated application session. Do not remove this check or deploy a public anonymous upload route.

## Configure

1. Create an R2 bucket and replace `bucket_name` in `wrangler.jsonc`.
2. Replace the `AUTH` service with your authentication Worker.
3. Set `PUBLIC_BASE_URL` to the origin serving this Worker or its image route.
4. Route `/api/images/*` and `/images/*` through this Worker on the same origin as the host application.
5. Run `npx wrangler types`, then deploy with `npx wrangler deploy`.

Use a custom domain for production image delivery. The example stores immutable UUID-based keys and streams public reads from the R2 binding.

## Host application

```js
import { createS3ImageUploader } from '@nonoim/editor/upload-s3';

export const uploadImages = createS3ImageUploader({
  provider: 'cloudflare-r2',
  getUploadRequest: async (file, { signal }) => {
    const response = await fetch('/api/images/prepare', {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
    });
    if (!response.ok) throw new Error(`Unable to prepare upload (${response.status}).`);
    return response.json();
  },
});
```

```vue
<NonoEditor v-model="markdown" :upload-images="uploadImages" />
```

The adapter sends the authenticated PUT request, reports byte progress, responds to the editor's cancel action, and returns the R2 public URL. Earlier files from local Base64 storage can be uploaded through this same provider and their Markdown URLs replaced.

For cross-origin API deployment, add an exact-origin CORS policy and keep credentialed origins explicit. The same-origin route shown here avoids a permissive upload CORS configuration.
