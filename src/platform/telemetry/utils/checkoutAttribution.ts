import { isPlainObject } from 'es-toolkit'

import type { CheckoutAttributionMetadata } from '../types'

type CheckoutAttribution = CheckoutAttributionMetadata

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

function readStoredAttribution(): Partial<Record<AttributionQueryKey, string>> {
  try {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    if (!isPlainObject(parsed)) return {}
    const result: Partial<Record<AttributionQueryKey, string>> = {}

    for (const key of ATTRIBUTION_QUERY_KEYS) {
      const value = parsed[key]
      if (typeof value === 'string' && value.length > 0) {
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
  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
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

export function captureCheckoutAttributionFromSearch(search: string): void {
  const stored = readStoredAttribution()
  const fromSearch = readAttributionFromUrl(search)
  if (Object.keys(fromSearch).length === 0) return
  if (!hasAttributionChanges(stored, fromSearch)) return

  persistAttribution({
    ...stored,
    ...fromSearch
  })
}

export function getCheckoutAttribution(): CheckoutAttribution {
  if (typeof window === 'undefined') return {}

  const stored = readStoredAttribution()
  const fromUrl = readAttributionFromUrl(window.location.search)
  const merged: Partial<Record<AttributionQueryKey, string>> = {
    ...stored,
    ...fromUrl
  }

  if (
    Object.keys(fromUrl).length > 0 &&
    hasAttributionChanges(stored, fromUrl)
  ) {
    persistAttribution(merged)
  }

  const gaIdentity = getGaIdentity()
  const impactClickId = merged.im_ref

  return {
    ...merged,
    impact_click_id: impactClickId,
    ga_client_id: gaIdentity?.client_id,
    ga_session_id: gaIdentity?.session_id,
    ga_session_number: gaIdentity?.session_number
  }
}
