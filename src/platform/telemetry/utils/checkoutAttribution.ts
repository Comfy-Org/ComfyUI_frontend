import { isPlainObject } from 'es-toolkit'

interface CheckoutAttribution {
  ga_client_id?: string
  ga_session_id?: string
  ga_session_number?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
}

type GaIdentity = {
  client_id?: string
  session_id?: string
  session_number?: string
}

const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const
type ClickIdKey = (typeof CLICK_ID_KEYS)[number]
const ATTRIBUTION_STORAGE_KEY = 'comfy_checkout_attribution'

function readStoredClickIds(): Partial<Record<ClickIdKey, string>> {
  try {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    if (!isPlainObject(parsed)) return {}
    const result: Partial<Record<ClickIdKey, string>> = {}

    for (const key of CLICK_ID_KEYS) {
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

function persistClickIds(payload: Partial<Record<ClickIdKey, string>>): void {
  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

function readClickIdsFromUrl(
  search: string
): Partial<Record<ClickIdKey, string>> {
  const params = new URLSearchParams(search)

  const result: Partial<Record<ClickIdKey, string>> = {}

  for (const key of CLICK_ID_KEYS) {
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

export function getCheckoutAttribution(): CheckoutAttribution {
  if (typeof window === 'undefined') return {}

  const stored = readStoredClickIds()
  const fromUrl = readClickIdsFromUrl(window.location.search)
  const merged: Partial<Record<ClickIdKey, string>> = {
    ...stored,
    ...fromUrl
  }

  if (Object.keys(fromUrl).length > 0) {
    persistClickIds(merged)
  }

  const gaIdentity = getGaIdentity()

  return {
    ...merged,
    ga_client_id: gaIdentity?.client_id,
    ga_session_id: gaIdentity?.session_id,
    ga_session_number: gaIdentity?.session_number
  }
}
