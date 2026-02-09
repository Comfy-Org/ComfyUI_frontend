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
  'impact_click_id',
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
const GENERATE_CLICK_ID_TIMEOUT_MS = 300
const IMPACT_CLICK_ID_STORAGE_KEY = 'comfy_impact_click_id'

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

function getImpactClickId(
  attribution: Partial<Record<AttributionQueryKey, string>>
): string | undefined {
  return attribution.impact_click_id ?? attribution.im_ref
}

function readStoredImpactClickId(): string | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    return asNonEmptyString(localStorage.getItem(IMPACT_CLICK_ID_STORAGE_KEY))
  } catch {
    return undefined
  }
}

function persistImpactClickId(clickId: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(IMPACT_CLICK_ID_STORAGE_KEY, clickId)
  } catch {
    return
  }
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

  return await new Promise((resolve) => {
    let settled = false

    const finish = (value: unknown): void => {
      if (settled) return
      settled = true
      resolve(asNonEmptyString(value))
    }

    const timeoutHandle = window.setTimeout(() => {
      finish(undefined)
    }, GENERATE_CLICK_ID_TIMEOUT_MS)

    try {
      impactQueue('generateClickId', (clickId: unknown) => {
        window.clearTimeout(timeoutHandle)
        finish(clickId)
      })
    } catch {
      window.clearTimeout(timeoutHandle)
      finish(undefined)
    }
  })
}

export function captureCheckoutAttributionFromSearch(search: string): void {
  const fromUrl = readAttributionFromUrl(search)
  const clickId = getImpactClickId(fromUrl)

  if (!clickId) return

  persistImpactClickId(clickId)
}

export async function getCheckoutAttribution(): Promise<CheckoutAttribution> {
  if (typeof window === 'undefined') return {}

  const fromUrl = readAttributionFromUrl(window.location.search)
  const generatedClickId = await getGeneratedClickId()
  const storedClickId = readStoredImpactClickId()

  const gaIdentity = getGaIdentity()
  const impactClickId =
    generatedClickId ?? getImpactClickId(fromUrl) ?? storedClickId

  if (impactClickId && impactClickId !== storedClickId) {
    persistImpactClickId(impactClickId)
  }

  return {
    ...fromUrl,
    ...(impactClickId
      ? {
          im_ref: impactClickId,
          impact_click_id: impactClickId
        }
      : {}),
    ga_client_id: gaIdentity?.client_id,
    ga_session_id: gaIdentity?.session_id,
    ga_session_number: gaIdentity?.session_number
  }
}
