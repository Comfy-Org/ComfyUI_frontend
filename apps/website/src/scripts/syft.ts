const SYFT_SOURCE_ID =
  import.meta.env.PUBLIC_SYFT_SOURCE_ID ?? 'cmo1xgq4o000804jr5jlj5dtn'
const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

let initialized = false

/**
 * Loads the SyftData snippet for anonymous visitor observation.
 * Idempotent with the Syft tag in GTM: no-ops if `window.syft` exists.
 */
export function initSyft() {
  if (initialized || typeof window === 'undefined' || !SYFT_SOURCE_ID) return
  try {
    window.syftc = { sourceId: SYFT_SOURCE_ID }
    if (window.syft) {
      initialized = true
      return
    }
    const q: unknown[][] = []
    const enqueue =
      (method: string) =>
      (...args: unknown[]) => {
        q.push([method, ...args])
      }
    window.syft = {
      q,
      fi: [],
      identify: enqueue('identify'),
      signup: enqueue('signup'),
      track: enqueue('track'),
      page: enqueue('page')
    }
    const script = document.createElement('script')
    script.src = SYFT_SRC
    script.async = true
    document.head.appendChild(script)
    initialized = true
  } catch (error) {
    console.error('Syft init failed', error)
  }
}
