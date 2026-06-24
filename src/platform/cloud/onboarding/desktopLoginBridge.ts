import type { User } from 'firebase/auth'
import type { LocationQuery } from 'vue-router'

import { getFirebaseConfig } from '@/config/firebase'
import { identifyPostHogUser } from '@/platform/telemetry/providers/cloud/posthogIdentity'

const CALLBACK_PARAM = 'desktop_login_callback'
const STATE_PARAM = 'desktop_login_state'
const MAX_STATE_LENGTH = 256
const DESKTOP_LOGIN_CALLBACK_PORT = '9876'
const DESKTOP_LOGIN_CALLBACK_TIMEOUT_MS = 10_000

function firstQueryValue(value: LocationQuery[string]): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseLoopbackCallback(rawUrl: string): URL | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'http:') return null
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) return null
  if (url.port !== DESKTOP_LOGIN_CALLBACK_PORT) return null
  if (url.pathname !== '/callback') return null

  return url
}

export function hasDesktopLoginRequest(query: LocationQuery): boolean {
  return Boolean(getDesktopLoginRequest(query))
}

export function getDesktopLoginRequest(query: LocationQuery): {
  callbackUrl: URL
  state: string
} | null {
  const callback = firstQueryValue(query[CALLBACK_PARAM])
  const state = firstQueryValue(query[STATE_PARAM])
  if (!callback || !state || state.length > MAX_STATE_LENGTH) return null

  const callbackUrl = parseLoopbackCallback(callback)
  if (!callbackUrl) return null

  return { callbackUrl, state }
}

export async function completeDesktopLoginIfNeeded(
  query: LocationQuery,
  user: User | null | undefined
): Promise<boolean> {
  const request = getDesktopLoginRequest(query)
  if (!request || !user) return false

  const firebaseConfig = getFirebaseConfig()
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API key missing')
  }

  // Queue-safe: if PostHog has not finished initializing yet, the cloud
  // provider flushes this identify call once the browser cookie store is ready.
  identifyPostHogUser(user.uid)

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    DESKTOP_LOGIN_CALLBACK_TIMEOUT_MS
  )

  let response: Response
  try {
    response = await fetch(request.callbackUrl.href, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: request.state,
        apiKey: firebaseConfig.apiKey,
        user: user.toJSON()
      })
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Desktop login callback timed out', { cause: error })
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`Desktop login callback returned ${response.status}`)
  }

  return true
}
