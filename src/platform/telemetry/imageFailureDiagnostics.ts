import type { ImageLoadFailureMetadata } from '@/platform/telemetry/types'

/**
 * An `<img>` `error` event carries no status, no headers and no body — the
 * browser tells you it failed and nothing else. That is why FE-1595 needed the
 * reporting artist's Network tab: `app:image_load_failed` fired on every broken
 * preview but could not say whether the cause was an expired session cookie
 * (401), a missing output (404), or a dropped connection.
 *
 * So we re-request the same URL once, only after a failure, and report the
 * status the browser would not give us. The probe is deliberately cheap and
 * deliberately incapable of making things worse:
 *
 * - `Range: bytes=0-0` asks for a single byte, so a probe of a 20MB output does
 *   not re-download it. Servers that ignore `Range` answer 200 with the body,
 *   which is why the response is never read.
 * - `credentials: 'include'` mirrors how the browser sent the original `<img>`
 *   request. Probing without it would send no cookie and manufacture the very
 *   401 we are trying to measure.
 * - Failures resolve to `probe_failed`/`probe_blocked` rather than throwing. A
 *   diagnostic must never become the second error in the report.
 */

/** Probes are capped per page so a node retrying a missing file in a loop cannot amplify. */
const MAX_PROBES_PER_PAGE = 20

/** A probe that outlives this is worth less than the request it occupies. */
const PROBE_TIMEOUT_MS = 5_000

let probesIssued = 0

/** Test seam — the cap is module state that would otherwise leak across cases. */
export function resetImageFailureProbesForTest(): void {
  probesIssued = 0
}

/**
 * `type` in an `/api/view` URL distinguishes a generated output from a user
 * upload. A 404 on `output` means the result expired or was swept; a 404 on
 * `input` means the upload never landed. They are different bugs and the
 * current event cannot tell them apart.
 */
function resourceKind(url: URL): ImageLoadFailureMetadata['resource_kind'] {
  const type = url.searchParams.get('type')
  if (type === 'output' || type === 'input' || type === 'temp') return type
  return url.searchParams.has('filename') ? 'unspecified' : 'not_api_view'
}

/**
 * The filename shape separates "a generation we produced" from "a template
 * asset we ship". Template thumbnails 404ing is a packaging bug on our side;
 * a hashed output 404ing is a retention/lifecycle bug. Reporting the shape
 * rather than the name keeps user-authored filenames out of telemetry.
 */
function filenameKind(url: URL): ImageLoadFailureMetadata['filename_kind'] {
  const filename = url.searchParams.get('filename')
  if (!filename) return 'none'
  if (filename.startsWith('template-')) return 'template'
  if (/^[0-9a-f]{64}\./i.test(filename)) return 'content_hash'
  return 'named'
}

async function probeStatus(
  src: string
): Promise<Pick<ImageLoadFailureMetadata, 'status' | 'probe_outcome'>> {
  if (probesIssued >= MAX_PROBES_PER_PAGE) {
    return { probe_outcome: 'probe_capped' }
  }
  probesIssued += 1

  try {
    const response = await fetch(src, {
      method: 'GET',
      credentials: 'include',
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    // The body is never read: `Range` already bounded it, and cancelling here
    // releases the connection instead of buffering an image we will not show.
    void response.body?.cancel()
    return { status: response.status, probe_outcome: 'probed' }
  } catch (error) {
    // An opaque/CORS/offline failure is itself the finding: the request never
    // reached a server that could answer, so no status exists to report.
    return {
      probe_outcome:
        error instanceof DOMException && error.name === 'TimeoutError'
          ? 'probe_timeout'
          : 'probe_failed'
    }
  }
}

/**
 * Builds the metadata for one failed preview. Never throws and never rejects.
 *
 * `page_age_ms` is the field that would have identified FE-1595 on its own: the
 * session-cookie bug could only strike a page open longer than the cookie's
 * 2-hour life, so an auth-caused failure population skews old while a 404
 * population does not. It is page age, not session age — a reload mints a fresh
 * cookie, which is exactly the boundary that matters.
 */
export async function describeImageLoadFailure(
  src: string
): Promise<ImageLoadFailureMetadata> {
  const base: ImageLoadFailureMetadata = {
    source: 'node_image_preview',
    page_age_ms: Math.round(performance.now()),
    online: navigator.onLine,
    resource_kind: 'not_api_view',
    filename_kind: 'none',
    probe_outcome: 'probe_blocked'
  }

  // An empty src is not a malformed URL — it resolves to the page itself, so
  // probing it would re-request the HTML document and report a 200 for an image
  // that never loaded. Reject it before parsing.
  if (!src.trim()) return { ...base, probe_outcome: 'invalid_src' }

  let url: URL
  try {
    url = new URL(src, window.location.href)
  } catch {
    // A malformed src never reached the network, so there is nothing to probe
    // and the shape fields would be fabrications.
    return { ...base, probe_outcome: 'invalid_src' }
  }

  const shape = {
    ...base,
    resource_kind: resourceKind(url),
    filename_kind: filenameKind(url),
    same_origin: url.origin === window.location.origin
  }

  // Cross-origin images are opaque to `fetch` without CORS, so a probe would
  // report our own failure rather than the server's answer.
  if (!shape.same_origin) return shape

  return { ...shape, ...(await probeStatus(src)) }
}
