import { useCurrentUser } from 'vuefire'

import type { ServerFeatureFlag } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'

const STORAGE_KEY = 'Comfy.FeatureFlagOverride'
const QUERY_PARAM = 'ff'
const EMPLOYEE_EMAIL_DOMAIN = '@comfy.org'

type OverridableFlagType = 'boolean' | 'string'
type OverrideValue = boolean | string

/**
 * Flags that opt in to session overrides, and the value type each one accepts.
 *
 * Adding a key here is the only way to make a flag overridable — an unlisted
 * flag is ignored, so a stale link can never reach into unrelated behaviour.
 * The declared type is what makes `?ff=some_flag:false` resolve to the boolean
 * `false` rather than the truthy string `'false'`.
 */
const OVERRIDABLE_FEATURE_FLAGS = {
  asset_rename_enabled: 'boolean',
  comfyhub_profile_gate_enabled: 'boolean',
  comfyhub_upload_enabled: 'boolean',
  model_upload_button_enabled: 'boolean',
  onboarding_survey_enabled: 'boolean',
  onboarding_tour_enabled: 'boolean',
  partner_node_governance_enabled: 'boolean',
  private_models_enabled: 'boolean',
  signup_turnstile: 'string',
  supports_model_type_tags: 'boolean',
  user_secrets_enabled: 'boolean',
  workflow_sharing_enabled: 'boolean'
} as const satisfies Partial<
  Record<`${ServerFeatureFlag}`, OverridableFlagType>
>

type OverridableFlag = keyof typeof OVERRIDABLE_FEATURE_FLAGS
type OverrideMap = Partial<Record<OverridableFlag, OverrideValue>>

function isOverridableFlag(name: string): name is OverridableFlag {
  return Object.hasOwn(OVERRIDABLE_FEATURE_FLAGS, name)
}

/**
 * Reads Firebase auth straight from VueFire rather than through `authStore`,
 * which would pull the whole app module graph into every feature flag read.
 * The ref holds undefined until auth resolves and null when signed out.
 */
function currentFirebaseUser() {
  try {
    return useCurrentUser().value
  } catch {
    return null
  }
}

/**
 * Overrides apply only to a signed-in Comfy employee, so a link handed to a
 * customer stays inert on their machine.
 */
function isComfyEmployee(): boolean {
  const user = currentFirebaseUser()
  if (!user?.emailVerified) return false

  return user.email?.toLowerCase().endsWith(EMPLOYEE_EMAIL_DOMAIN) ?? false
}

function parseOverrideValue(
  flag: OverridableFlag,
  rawValue: string | undefined
): OverrideValue | undefined {
  if (OVERRIDABLE_FEATURE_FLAGS[flag] === 'string') {
    return rawValue || undefined
  }
  if (rawValue === undefined) return true

  const normalized = rawValue.toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

/**
 * The captured overrides plus the query string they came from. Remembering the
 * source makes capture idempotent: re-reading the same URL neither re-warns nor
 * rewrites, so a flag can be read as often as a render needs.
 */
type StoredState = { search: string; overrides: OverrideMap }

function emptyState(): StoredState {
  return { search: '', overrides: {} }
}

function coerceStoredOverrides(value: unknown): OverrideMap {
  if (typeof value !== 'object' || value === null) return {}

  const overrides: OverrideMap = {}
  for (const [name, entry] of Object.entries(value)) {
    if (!isOverridableFlag(name)) continue
    if (typeof entry !== 'boolean' && typeof entry !== 'string') continue
    if (typeof entry !== OVERRIDABLE_FEATURE_FLAGS[name]) continue
    overrides[name] = entry
  }
  return overrides
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
  try {
    return new URLSearchParams(search).getAll(QUERY_PARAM)
  } catch {
    return []
  }
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

    if (!isOverridableFlag(name)) {
      console.warn(`[ff] "${name}" is not registered as an overridable flag`)
      continue
    }

    const value = parseOverrideValue(name, rawValue)
    if (value === undefined) {
      console.warn(
        `[ff] Invalid ${OVERRIDABLE_FEATURE_FLAGS[name]} value for "${name}":`,
        rawValue
      )
      continue
    }

    overrides[name] = value
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
 * Gets a session feature flag override requested via `?ff=name` (boolean flags)
 * or `?ff=name:value`, repeatable to override several flags at once.
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
  if (!isOverridableFlag(flagKey)) return undefined
  if (!Object.hasOwn(overrides, flagKey)) return undefined
  if (!isComfyEmployee()) return undefined

  return overrides[flagKey] as T
}
