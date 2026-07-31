# @comfyorg/shared-frontend-utils

Framework-agnostic frontend utilities shared across Comfy Org applications. Extracted from [ComfyUI_frontend](https://github.com/Comfy-Org/ComfyUI_frontend) so that other Comfy web properties can reuse the same formatting, networking, and telemetry helpers instead of duplicating them.

Published as compiled ESM with type declarations. There is no default export — import the entrypoint you need.

## Installation

```bash
npm install @comfyorg/shared-frontend-utils
```

`axios` and `dompurify` are regular dependencies and are installed for you.

## Entrypoints

### `formatUtil`

Formatting and parsing helpers for filenames, paths, numbers, dates, durations, and user-supplied strings.

```ts
import {
  formatSize,
  formatDuration,
  getMediaTypeFromFilename,
  normalizeI18nKey,
  parseFilePath
} from '@comfyorg/shared-frontend-utils/formatUtil'

formatSize(1536) // '1.5 KB'
formatDuration(90_000) // '1m 30s'
getMediaTypeFromFilename('clip.webm') // 'video'
parseFilePath('output/run_1/image.png') // { filename: 'image.png', subfolder: 'output/run_1' }
normalizeI18nKey('sd_xl.safetensors') // 'sd_xl_safetensors'
```

`highlightQuery`, `linkifyHtml`, and `nl2br` return HTML sanitized with DOMPurify, so they require a DOM. Call them from browser code only, not during server-side rendering.

### `networkUtil`

Connectivity probes used to adapt behavior to the user's network.

```ts
import {
  checkUrlReachable,
  isInChina
} from '@comfyorg/shared-frontend-utils/networkUtil'

await checkUrlReachable('https://example.com')
await isInChina()
```

Both rely on browser globals (`navigator`, `fetch`) and issue cross-origin requests.

### `piiUtil`

PostHog hook that strips personally identifiable information from analytics events before they are sent.

```ts
import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

posthog.init(key, { before_send: createPostHogBeforeSend() })
```

## Releasing

Run the **Version Bump Shared Frontend Utils** workflow to open a version PR, then
merge it with the `Release` label. Publishing to npm happens automatically on merge.
