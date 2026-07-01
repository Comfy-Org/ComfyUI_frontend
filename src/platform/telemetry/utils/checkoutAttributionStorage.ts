import { isPlainObject } from 'es-toolkit'

const ATTRIBUTION_QUERY_KEYS = [
  'im_ref',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid'
] as const

export type AttributionQueryKey = (typeof ATTRIBUTION_QUERY_KEYS)[number]

const ATTRIBUTION_STORAGE_KEY = 'comfy_checkout_attribution'

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function readStoredAttribution(): Partial<
  Record<AttributionQueryKey, string>
> {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    if (!isPlainObject(parsed)) return {}

    const result: Partial<Record<AttributionQueryKey, string>> = {}

    for (const key of ATTRIBUTION_QUERY_KEYS) {
      const value = asNonEmptyString(parsed[key])
      if (value) {
        result[key] = value
      }
    }

    return result
  } catch {
    return {}
  }
}

export function persistAttribution(
  payload: Partial<Record<AttributionQueryKey, string>>
): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

export function readAttributionFromUrl(
  search: string
): Partial<Record<AttributionQueryKey, string>> {
  const params = new URLSearchParams(search)

  const result: Partial<Record<AttributionQueryKey, string>> = {}

  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = params.get(key)
    if (value) {
      result[key] = value
    }
  }

  return result
}

export function hasAttributionChanges(
  existing: Partial<Record<AttributionQueryKey, string>>,
  incoming: Partial<Record<AttributionQueryKey, string>>
): boolean {
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = incoming[key]
    if (value !== undefined && existing[key] !== value) {
      return true
    }
  }

  return false
}
