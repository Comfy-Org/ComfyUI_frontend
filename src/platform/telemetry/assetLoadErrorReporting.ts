import { parsePreloadError } from '@/utils/preloadErrorUtil'

import { reportError } from './reportError'

/**
 * Whether a failed resource is one we ship, and can therefore act on.
 *
 * The `error` listener in `App.vue` fires for every `<script>` and
 * `<link rel=stylesheet>` on the page, including the ones GTM, Meta and the
 * other marketing tags inject at runtime. Those fail constantly and for one
 * reason: the visitor runs an ad blocker. Reporting them made
 * `Resource load failed: …` the single largest error group on
 * cloud-frontend-prod, and because Sentry groups on this function's frame
 * rather than on the URL, every blocked host landed in ONE issue with our own
 * asset failures — so the group could be neither read nor archived without
 * losing the failures that matter.
 *
 * Same-origin is the line: our JS and CSS are served from the page's origin.
 * A URL we cannot parse is reported rather than dropped, because an unparseable
 * asset URL is itself a bug worth seeing.
 *
 * Accepted loss: `t.comfy.org` (the PostHog proxy) is ours but cross-origin, so
 * its load failures stop being reported here. They are overwhelmingly the same
 * ad blockers, and a real outage of that host shows up as missing PostHog
 * volume, which is the signal that would actually be watched.
 */
function isFirstPartyResource(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return true
  }
}

/**
 * Asset failures reach a sink only on cloud builds, and `reportError` writes
 * the console line there. Every other distribution logs locally instead, so
 * one failure never produces two console lines or two RUM events.
 *
 * Third-party resources are dropped on every distribution: they are not ours to
 * fix, and the local console line is as much noise as the Sentry event.
 */
export function reportResourceLoadError(url: string, tagName: string): void {
  if (!isFirstPartyResource(url)) return

  if (__DISTRIBUTION__ !== 'cloud') {
    console.error('[resource:loadError]', { url, tagName })
    return
  }

  reportError(new Error(`Resource load failed: ${url}`), {
    errorType: 'resource_load_error',
    tags: { tag_name: tagName }
  })
}

export function reportPreloadError(error: Error): void {
  const info = parsePreloadError(error)

  if (__DISTRIBUTION__ !== 'cloud') {
    console.error('[vite:preloadError]', {
      url: info.url,
      fileType: info.fileType,
      chunkName: info.chunkName,
      message: info.message
    })
    return
  }

  reportError(error, {
    errorType: 'vite_preload_error',
    tags: {
      file_type: info.fileType,
      chunk_name: info.chunkName ?? undefined
    },
    context: {
      url: info.url,
      fileType: info.fileType,
      chunkName: info.chunkName
    }
  })
}
