import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import type { AuthMetadata, TelemetryProvider } from '../../types'

const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

let scriptPromise: Promise<void> | null = null

function normalizeEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() || null
}

function createTraits(
  source: SyftDataSource,
  method?: SyftDataAuthMethod
): SyftDataTraits {
  return method ? { source, method } : { source }
}

function createSyftStub(): SyftDataClient {
  const q: unknown[][] = []
  const fi: SyftDataPendingFetch[] = []

  function enqueue(method: string) {
    return (...args: unknown[]) => {
      q.push([method, ...args])
    }
  }

  function fetchID(...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      fi.push({ args, resolve, reject })
    })
  }

  return {
    q,
    fi,
    fetchID,
    identify: enqueue('identify'),
    signup: enqueue('signup'),
    track: enqueue('track'),
    page: enqueue('page')
  }
}

function bootstrapSyftClient(): SyftDataClient | null {
  const sourceId = remoteConfig.value.syftdata_source_id
  if (!sourceId) return window.syft ?? null

  window.syftc = { sourceId }
  if (window.syft) return window.syft

  const stub = createSyftStub()
  window.syft = stub

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${SYFT_SRC}"]`
  )
  if (existingScript || scriptPromise) return window.syft

  const scriptEl = document.createElement('script')
  scriptEl.src = SYFT_SRC
  scriptEl.async = true

  scriptPromise = new Promise<void>((resolve, reject) => {
    scriptEl.addEventListener('load', () => resolve(), { once: true })
    scriptEl.addEventListener(
      'error',
      () => {
        scriptEl.remove()
        if (window.syft === stub) {
          delete window.syft
        }
        scriptPromise = null
        reject(new Error('Syft script failed to load'))
      },
      { once: true }
    )
  }).catch((error) => {
    console.warn('[Syft] SDK failed to load', error)
  })

  document.head.appendChild(scriptEl)
  return window.syft
}

export class SyftTelemetryProvider implements TelemetryProvider {
  private lastHandledEmail: string | null = null

  constructor() {
    bootstrapSyftClient()
  }

  trackAuth({ email, is_new_user, method }: AuthMetadata): void {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return

    this.identify(
      normalizedEmail,
      createTraits(is_new_user ? 'signup' : 'login', method)
    )
  }

  trackUserLoggedIn(): void {
    const normalizedEmail = normalizeEmail(useCurrentUser().userEmail.value)
    if (!normalizedEmail || normalizedEmail === this.lastHandledEmail) return

    this.identify(normalizedEmail, createTraits('login'))
  }

  private identify(email: string, traits: SyftDataTraits): void {
    const syft = bootstrapSyftClient()
    if (!syft) return

    syft.identify(email, traits)
    this.lastHandledEmail = email
  }
}
