import { useImage } from '@vueuse/core'

/**
 * `useImage()` that handles load failures quietly.
 *
 * `useImage()` already surfaces failures via its returned `error` ref (callers
 * render a fallback). By default vueuse ALSO forwards the error to
 * `globalThis.reportError`, which our error monitoring (Datadog RUM) captures as
 * an unhandled error for every broken image — 404'd thumbnails, expired share
 * links, in-app browsers that re-fetch in a loop. Broken images are expected,
 * not bugs, so handle the failure here instead of letting it surface globally.
 * The returned `error` ref behaviour is unchanged.
 */
export function useImageQuiet(options: Parameters<typeof useImage>[0]) {
  return useImage(options, {
    onError: () => {
      // Surfaced via the returned `error` ref; see the doc comment above.
    }
  })
}
