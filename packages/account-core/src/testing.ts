/**
 * The test seam for fakes: a hand-written port becomes an identity the
 * session client accepts. Production hosts use `@comfyorg/account-core/firebase`.
 */
import type { WebSessionUser } from './core/sessionContracts.js'

export type { IdentityPort } from './core/identity.js'
export { brandIdentity as createTestIdentity } from './core/identity.js'

// Enumerating wording (CWE-204) each host asserts its copy never matches; shared so the two suites can't drift.
export const ENUMERATION_ORACLE =
  /\bexists?\b|already (?:registered|in use|have|exists)|wrong password|no account|not found|is registered|different (?:sign-in method|credential)/i

export type { WebSessionUser } from './core/sessionContracts.js'

export function fakeWebSessionUser(
  overrides: Partial<WebSessionUser> = {}
): WebSessionUser {
  return {
    id: 'user-1',
    email: 'user-1@example.com',
    name: 'Test User',
    emailVerified: true,
    signInProvider: 'google.com',
    ...overrides
  }
}

/** The five boot cases, plus any other transient status. */
export type FakeWebSessionState =
  | { readonly kind: 'live'; readonly user: WebSessionUser }
  | {
      readonly kind: 'dead'
      readonly code: 'no_session' | 'session_expired' | 'session_revoked'
    }
  | { readonly kind: 'network_error' }
  | { readonly kind: 'unavailable'; readonly status: number }

export interface FakeWebSessionRequest {
  readonly method: string
  readonly path: string
  readonly credentials: RequestCredentials | undefined
  readonly cache: RequestCache | undefined
  readonly headers: Readonly<Record<string, string>>
}

export interface FakeWebSessionEndpoint {
  readonly fetch: typeof fetch
  readonly requests: readonly FakeWebSessionRequest[]
  state: FakeWebSessionState
}

const FAKE_CSRF_TOKEN = 'fake-csrf-token'
const DAY_MS = 24 * 60 * 60 * 1000

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, { code, message: code })
}

/**
 * A `fetch` serving ingest's session routes under `/api/auth`. POST with a
 * bearer proof signs `signInUser` in; DELETE and revoke-all leave the cookie
 * revoked, as the real endpoint does.
 */
export function createFakeWebSessionEndpoint({
  state,
  signInUser = fakeWebSessionUser(),
  now = Date.now
}: {
  state: FakeWebSessionState
  signInUser?: WebSessionUser
  now?: () => number
}): FakeWebSessionEndpoint {
  const requests: FakeWebSessionRequest[] = []
  const endpoint: FakeWebSessionEndpoint = {
    state,
    requests,
    fetch: async (input, init = {}) => {
      const method = (init.method ?? 'GET').toUpperCase()
      const { pathname } = new URL(
        input instanceof Request ? input.url : String(input)
      )
      const requestHeaders = new Headers(init.headers)
      const headers = Object.fromEntries(requestHeaders)
      requests.push({
        method,
        path: pathname,
        credentials: init.credentials,
        cache: init.cache,
        headers
      })

      const current = endpoint.state
      if (current.kind === 'network_error') {
        throw new TypeError('Failed to fetch')
      }
      if (current.kind === 'unavailable') {
        return errorResponse(current.status, 'unavailable')
      }
      const route = `${method} ${pathname}`
      if (route === 'POST /api/auth/session') {
        if (!requestHeaders.get('authorization')?.startsWith('Bearer ')) {
          return errorResponse(401, 'no_session')
        }
        endpoint.state = { kind: 'live', user: signInUser }
        return jsonResponse(200, { success: true, expiresIn: DAY_MS / 1000 })
      }
      if (route === 'DELETE /api/auth/session') {
        endpoint.state = { kind: 'dead', code: 'session_revoked' }
        return jsonResponse(200, { success: true })
      }
      if (current.kind === 'dead') return errorResponse(401, current.code)
      if (route === 'GET /api/auth/session') {
        const { user } = current
        return jsonResponse(200, {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            email_verified: user.emailVerified,
            sign_in_provider: user.signInProvider
          },
          csrf_token: FAKE_CSRF_TOKEN,
          expires_at: new Date(now() + DAY_MS).toISOString(),
          absolute_expires_at: new Date(now() + 7 * DAY_MS).toISOString()
        })
      }
      if (route === 'POST /api/auth/sessions/revoke-all') {
        if (requestHeaders.get('x-csrf-token') !== FAKE_CSRF_TOKEN) {
          return errorResponse(403, 'csrf_invalid')
        }
        endpoint.state = { kind: 'dead', code: 'session_revoked' }
        return new Response(null, { status: 204 })
      }
      return errorResponse(404, 'not_found')
    }
  }
  return endpoint
}
