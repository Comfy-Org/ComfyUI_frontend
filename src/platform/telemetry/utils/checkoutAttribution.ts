import { isPlainObject } from 'es-toolkit'
import { withTimeout } from 'es-toolkit/promise'

import type { CheckoutAttributionMetadata } from '../types'

type GaIdentity = {
  client_id?: string
  session_id?: string
  session_number?: string
}

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
type AttributionQueryKey = (typeof ATTRIBUTION_QUERY_KEYS)[number]
const ATTRIBUTION_STORAGE_KEY = 'comfy_checkout_attribution'
const GENERATE_CLICK_ID_TIMEOUT_MS = 300

function readStoredAttribution(): Partial<Record<AttributionQueryKey, string>> {
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

function persistAttribution(
  payload: Partial<Record<AttributionQueryKey, string>>
): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

function readAttributionFromUrl(
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

function hasAttributionChanges(
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

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getGaIdentity(): GaIdentity | undefined {
  if (typeof window === 'undefined') return undefined

  const identity = window.__ga_identity__
  if (!isPlainObject(identity)) return undefined

  return {
    client_id: asNonEmptyString(identity.client_id),
    session_id: asNonEmptyString(identity.session_id),
    session_number: asNonEmptyString(identity.session_number)
  }
}

async function getGeneratedClickId(): Promise<string | undefined> {
  if (typeof window === 'undefined') {
    return undefined
  }

  const impactQueue = window.ire
  if (typeof impactQueue !== 'function') {
    return undefined
  }

  try {
    return await withTimeout(
      () =>
        new Promise<string | undefined>((resolve, reject) => {
          try {
            impactQueue('generateClickId', (clickId: unknown) => {
              resolve(asNonEmptyString(clickId))
            })
          } catch (error) {
            reject(error)
          }
        }),
      GENERATE_CLICK_ID_TIMEOUT_MS
    )
  } catch {
    return undefined
  }
}

export function captureCheckoutAttributionFromSearch(search: string): void {
  const fromUrl = readAttributionFromUrl(search)
  const storedAttribution = readStoredAttribution()
  if (Object.keys(fromUrl).length === 0) return

  if (!hasAttributionChanges(storedAttribution, fromUrl)) return

  persistAttribution({
    ...storedAttribution,
    ...fromUrl
  })
}

export async function getCheckoutAttribution(): Promise<CheckoutAttributionMetadata> {
  if (typeof window === 'undefined') return {}

  const storedAttribution = readStoredAttribution()
  const fromUrl = readAttributionFromUrl(window.location.search)
  const generatedClickId = await getGeneratedClickId()
  const attribution: Partial<Record<AttributionQueryKey, string>> = {
    ...storedAttribution,
    ...fromUrl
  }

  if (generatedClickId) {
    attribution.im_ref = generatedClickId
  }

  if (hasAttributionChanges(storedAttribution, attribution)) {
    persistAttribution(attribution)
  }

  const gaIdentity = getGaIdentity()

  return {
    ...attribution,
    ga_client_id: gaIdentity?.client_id,
    ga_session_id: gaIdentity?.session_id,
    ga_session_number: gaIdentity?.session_number
  }
}
