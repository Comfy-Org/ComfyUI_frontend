import { withTimeout } from 'es-toolkit/promise'

import type { CheckoutAttributionMetadata } from '../types'
import type { AttributionQueryKey } from './checkoutAttributionStorage'
import {
  asNonEmptyString,
  hasAttributionChanges,
  persistAttribution,
  readAttributionFromUrl,
  readStoredAttribution
} from './checkoutAttributionStorage'
import { getCheckoutPlatformSource } from './platformSource'

type GaIdentity = {
  client_id?: string
  session_id?: string
  session_number?: string
}

const GA_IDENTITY_FIELDS = [
  'client_id',
  'session_id',
  'session_number'
] as const satisfies ReadonlyArray<GtagGetFieldName>
type GaIdentityField = GtagGetFieldName

const GENERATE_CLICK_ID_TIMEOUT_MS = 300
const GET_GA_IDENTITY_TIMEOUT_MS = 300
const GET_REWARDFUL_REFERRAL_TIMEOUT_MS = 300

async function getGaIdentityField(
  measurementId: string,
  fieldName: GaIdentityField
): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return undefined
  }
  const gtag = window.gtag

  return withTimeout(
    () =>
      new Promise<string | undefined>((resolve) => {
        gtag('get', measurementId, fieldName, (value) => {
          resolve(asNonEmptyString(value))
        })
      }),
    GET_GA_IDENTITY_TIMEOUT_MS
  ).catch(() => undefined)
}

async function getGaIdentity(): Promise<GaIdentity | undefined> {
  const measurementId = asNonEmptyString(window.__CONFIG__?.ga_measurement_id)
  if (!measurementId) {
    return undefined
  }

  const [clientId, sessionId, sessionNumber] = await Promise.all(
    GA_IDENTITY_FIELDS.map((fieldName) =>
      getGaIdentityField(measurementId, fieldName)
    )
  )

  if (!clientId && !sessionId && !sessionNumber) {
    return undefined
  }

  return {
    client_id: clientId,
    session_id: sessionId,
    session_number: sessionNumber
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

async function getRewardfulReferral(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined

  const referral = asNonEmptyString(window.Rewardful?.referral)
  if (referral) return referral

  const rewardful = window.rewardful
  if (typeof rewardful !== 'function') return undefined

  return withTimeout(
    () =>
      new Promise<string | undefined>((resolve, reject) => {
        try {
          rewardful('ready', () => {
            resolve(asNonEmptyString(window.Rewardful?.referral))
          })
        } catch (error) {
          reject(error)
        }
      }),
    GET_REWARDFUL_REFERRAL_TIMEOUT_MS
  ).catch(() => undefined)
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
  const rewardfulReferralPromise = getRewardfulReferral()
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

  const [gaIdentity, rewardfulReferral] = await Promise.all([
    getGaIdentity(),
    rewardfulReferralPromise
  ])

  return {
    ...attribution,
    platform_source: getCheckoutPlatformSource(),
    ga_client_id: gaIdentity?.client_id,
    ga_session_id: gaIdentity?.session_id,
    ga_session_number: gaIdentity?.session_number,
    rewardful_referral: rewardfulReferral
  }
}
