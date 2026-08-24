import { parseQuery } from 'vue-router'
import { useCurrentUser } from 'vuefire'

import { isCloud } from '@/platform/distribution/types'

const STORAGE_KEY = 'Comfy.FeatureFlagOverride'
const QUERY_PARAM = 'ff'
const EMPLOYEE_EMAIL_DOMAIN = '@comfy.org'

type OverrideMap = Record<string, unknown>

/**
 * Overrides apply only to a signed-in Comfy employee, so a link handed to a
 * customer stays inert on their machine. With every flag overridable, this is
 * the only thing standing between a `?ff=` link and the app's behaviour, so it
 * fails closed.
 *
 * Reads VueFire rather than `authStore`, which imports `useFeatureFlags` and
 * would drag the whole app module graph into every feature flag read.
 */
function isComfyEmployee(): boolean {
  try {
    const user = useCurrentUser().value
    if (!user?.emailVerified) return false

    return user.email?.toLowerCase().endsWith(EMPLOYEE_EMAIL_DOMAIN) ?? false
  } catch {
    return false
  }
}

/**
 * Reads the value with the same JSON semantics as the `ff:` localStorage
 * override, so `:false` is the boolean and `:12` the number rather than a
 * truthy string. Anything JSON rejects is taken as a plain string, which is
 * what makes `:enforce` work; quote it (`:"12"`) to force a numeric-looking
 * value to stay a string. A bare `?ff=name` means "turn this on".
 */
function parseOverrideValue(rawValue: string | undefined): unknown {
  if (rawValue === undefined) return true

  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

/**
 * The captured overrides plus the query string they came from. Remembering the
 * source makes capture idempotent: re-reading the same URL does not rewrite
 * storage, so a flag can be read as often as a render needs.
 */
type StoredState = { search: string; overrides: OverrideMap }

function emptyState(): StoredState {
  return { search: '', overrides: {} }
}

function coerceStoredOverrides(value: unknown): OverrideMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  return { ...value }
}

function readStoredState(): StoredState {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return emptyState()
  }
  if (!raw) return emptyState()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyState()
  }
  if (typeof parsed !== 'object' || parsed === null) return emptyState()

  const search = 'search' in parsed ? parsed.search : undefined
  const overrides = 'overrides' in parsed ? parsed.overrides : undefined
  return {
    search: typeof search === 'string' ? search : '',
    overrides: coerceStoredOverrides(overrides)
  }
}

function writeStoredState(state: StoredState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    console.warn('[ff] Failed to persist session feature flag overrides')
  }
}

function splitRequest(request: string): [name: string, value?: string] {
  const separator = request.indexOf(':')
  if (separator === -1) return [request]
  return [request.slice(0, separator), request.slice(separator + 1)]
}

function readOverrideRequests(search: string): string[] {
  const value = parseQuery(search)[QUERY_PARAM]
  if (value === undefined) return []
  return (Array.isArray(value) ? value : [value]).map((value) => value ?? '')
}

/**
 * Merges `?ff=` requests from the current URL into the overrides already held
 * for this tab. An `?ff=` with no name clears every override in the session.
 */
function captureRequests(
  requests: string[],
  stored: OverrideMap,
  search: string
): OverrideMap {
  if (requests.includes('')) {
    writeStoredState({ search, overrides: {} })
    return {}
  }

  const overrides: OverrideMap = { ...stored }
  for (const request of requests) {
    const [name, rawValue] = splitRequest(request)
    overrides[name] = parseOverrideValue(rawValue)
  }

  writeStoredState({ search, overrides })
  return overrides
}

function loadSessionOverrides(): OverrideMap {
  const stored = readStoredState()
  const search = window.location.search
  if (search === stored.search) return stored.overrides

  const requests = readOverrideRequests(search)
  if (requests.length === 0) return stored.overrides

  return captureRequests(requests, stored.overrides, search)
}

/**
 * Gets a session override for any feature flag, requested via `?ff=name` to
 * turn it on or `?ff=name:value` for a specific value, repeatable to override
 * several flags at once. A nameless `?ff=` clears the session.
 *
 * The request is captured into `sessionStorage` on the first read, so it
 * survives reloads and in-app navigation but dies when the tab closes. Capture
 * happens before authentication resolves; the employee check is applied here on
 * every read instead, so a flag flips as soon as the user is known.
 *
 * Returns undefined (not null) as the "no override" sentinel, matching
 * `getDevOverride`.
 */
export function getSessionOverride<T>(flagKey: string): T | undefined {
  if (!isCloud) return undefined

  const overrides = loadSessionOverrides()
  if (!Object.hasOwn(overrides, flagKey)) return undefined
  if (!isComfyEmployee()) return undefined

  return overrides[flagKey] as T
}
