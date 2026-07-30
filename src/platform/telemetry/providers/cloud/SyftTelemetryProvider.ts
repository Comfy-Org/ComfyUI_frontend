import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { normalizeEmail } from '@/platform/telemetry/utils/normalizeEmail'
import { createScriptLoader } from '@/utils/loadExternalScript'

import type { AuthMetadata, AuthMethod, TelemetryProvider } from '../../types'

const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

let currentStub: SyftDataClient | null = null
let lastIdentifiedEmail: string | null = null
let pendingIdentify: { email: string; traits: SyftDataTraits } | null = null
let hasReplayedIdentify = false

const loadSyftSdk = createScriptLoader<SyftDataClient | SyftDisabledClient>(
  SYFT_SRC,
  () => (window.syft && window.syft !== currentStub ? window.syft : null)
)

function createTraits(
  source: 'signup' | 'login',
  method?: AuthMethod
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

function ensureSyftClient(): SyftDataClient | SyftDisabledClient | null {
  const sourceId = remoteConfig.value.syftdata_source_id
  if (!sourceId) return window.syft ?? null

  window.syftc = { ...window.syftc, sourceId }
  if (window.syft) return window.syft

  const stub = createSyftStub()
  currentStub = stub
  window.syft = stub

  loadSyftSdk().then(
    () => {
      pendingIdentify = null
    },
    (error: unknown) => {
      const stubOwnsGlobal = window.syft === stub
      if (stubOwnsGlobal) {
        delete window.syft
        lastIdentifiedEmail = null
        stub.fi?.forEach((pending) => pending.reject(error))
      }
      if (currentStub === stub) {
        currentStub = null
      }
      console.warn('[Syft] SDK failed to load', error)
      if (stubOwnsGlobal) replayPendingIdentify()
    }
  )

  return window.syft
}

function replayPendingIdentify(): void {
  if (!pendingIdentify || hasReplayedIdentify) return

  hasReplayedIdentify = true
  identifyUser(pendingIdentify.email, pendingIdentify.traits)
}

function identifyUser(email: string, traits: SyftDataTraits): void {
  const syft = ensureSyftClient()
  if (!syft || !('identify' in syft)) return

  syft.identify(email, traits)
  lastIdentifiedEmail = email
  pendingIdentify = syft === currentStub ? { email, traits } : null
}

export class SyftTelemetryProvider implements TelemetryProvider {
  constructor() {
    ensureSyftClient()
  }

  trackAuth({ email, is_new_user, method }: AuthMetadata): void {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return

    identifyUser(
      normalizedEmail,
      createTraits(is_new_user ? 'signup' : 'login', method)
    )
  }

  trackUserLoggedIn(): void {
    const normalizedEmail = normalizeEmail(useCurrentUser().userEmail.value)
    if (!normalizedEmail || normalizedEmail === lastIdentifiedEmail) return

    identifyUser(normalizedEmail, createTraits('login'))
  }
}
