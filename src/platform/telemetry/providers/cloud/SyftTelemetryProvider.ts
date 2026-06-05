/**
 * SyftData Telemetry Provider - Cloud Build Implementation
 *
 * Loads the Syft snippet and identifies logged-in users by email so Syft
 * can enrich them (firmographics flow to PostHog via Syft's native
 * destination as `sy_*` person properties). Only implements trackAuth -
 * page/session capture is handled by Syft's own autotrack.
 *
 * The loader is idempotent with the Syft tag in GTM: whichever runs
 * first wins.
 *
 * CRITICAL: OSS Build Safety
 * Entire file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 */
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import type { AuthMetadata, TelemetryProvider } from '../../types'

const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

type SyftTraits = Record<string, string | number | null | undefined>

interface SyftPendingFetch {
  args: unknown[]
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

interface SyftClient {
  identify: (email: string, traits?: SyftTraits) => void
  signup: (email: string, traits?: SyftTraits) => void
  track: (event: string, traits?: SyftTraits) => void
  page: (...args: unknown[]) => void
  q?: unknown[][]
  fi?: SyftPendingFetch[]
  fetchID?: (...args: unknown[]) => Promise<unknown>
}

declare global {
  interface Window {
    syft?: SyftClient
    syftc?: { sourceId: string }
  }
}

/** Pre-load queue stub matching the official Syft loader snippet; the UMD
 *  script drains `q` and settles `fi` entries once it loads. */
function createSyftStub(): SyftClient {
  const q: unknown[][] = []
  const fi: SyftPendingFetch[] = []
  const enqueue =
    (method: string) =>
    (...args: unknown[]) => {
      q.push([method, ...args])
    }
  return {
    q,
    fi,
    fetchID: (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        fi.push({ args, resolve, reject })
      }),
    identify: enqueue('identify'),
    signup: enqueue('signup'),
    track: enqueue('track'),
    page: enqueue('page')
  }
}

let scriptPromise: Promise<void> | null = null

function ensureSyftLoaded(sourceId: string): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    window.syftc = { sourceId }
    if (!window.syft) {
      window.syft = createSyftStub()
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SYFT_SRC}"]`
    )
    if (existing) {
      resolve()
      return
    }

    const scriptEl = document.createElement('script')
    scriptEl.src = SYFT_SRC
    scriptEl.async = true
    scriptEl.addEventListener('load', () => resolve(), { once: true })
    scriptEl.addEventListener(
      'error',
      () => {
        scriptEl.remove()
        scriptPromise = null
        reject(new Error('Syft script failed to load'))
      },
      { once: true }
    )
    document.head.appendChild(scriptEl)
  })

  return scriptPromise
}

export class SyftTelemetryProvider implements TelemetryProvider {
  constructor() {
    const sourceId = window.__CONFIG__?.syftdata_source_id
    if (sourceId) {
      ensureSyftLoaded(sourceId).catch((error) => {
        console.warn('[Syft] snippet failed to load', error)
      })
    } else {
      console.warn('Syft source id not provided in runtime config')
    }

    // Re-identify on every session resolve so users who were already
    // logged in before this shipped still get linked to their Syft
    // profile. Session restores cannot distinguish new vs returning,
    // so source is 'login'. Registered even without a sourceId because
    // the GTM-loaded snippet may still provide window.syft.
    const currentUser = useCurrentUser()
    currentUser.onUserResolved(() => {
      const email = currentUser.userEmail.value
      if (email) {
        window.syft?.identify(email, { source: 'login' })
      }
    })
  }

  /** Identify at the auth action itself - the only moment signup vs
   *  login ("source") and auth method are knowable. */
  trackAuth({ email, is_new_user, method }: AuthMetadata): void {
    if (!email) return
    if (is_new_user) {
      window.syft?.signup(email, { source: 'signup', method })
    } else {
      window.syft?.identify(email, { source: 'login', method })
    }
  }
}
