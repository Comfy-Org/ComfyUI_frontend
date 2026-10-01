/**
 * The billing-web side of the contract: read an arriving URL back into the
 * request a product meant to make. Unknown query parameters are ignored, so a
 * product may add analytics noise without breaking the app; everything the
 * contract names is validated, because this is untrusted input.
 */
import type { BillingIntent, BillingProduct } from './contract.js'
import {
  BILLING_CONTRACT_VERSION,
  isBillingIntent,
  isBillingProduct
} from './contract.js'
import type {
  InvalidIdentifierCode,
  OptionalEntryKey,
  OptionalEntryValues
} from './entryFields.js'
import {
  ENTRY_PARAM_AMOUNT,
  ENTRY_PARAM_PRODUCT,
  ENTRY_PARAM_RETURN_TO,
  OPTIONAL_ENTRY_FIELDS,
  readEntryAmountCents
} from './entryFields.js'
import { isContractIdentifier } from './identifiers.js'
import type { ReturnTarget } from './returnTargets.js'
import { isReturnTarget } from './returnTargets.js'
import { CONTRACT_PARSE_BASE, parseUrl } from './url.js'

export interface BillingEntry extends OptionalEntryValues {
  readonly version: typeof BILLING_CONTRACT_VERSION
  readonly intent: BillingIntent
  readonly product: BillingProduct
  readonly returnTo: ReturnTarget
  /**
   * A `promo` value outside the identifier charset, exactly as the link
   * carried it. Checkout shows it refused in the field; it never reaches a
   * URL and never voids the rest of the request.
   */
  readonly unreadablePromotionCode?: string
  /** The credit amount a top-up asks for, in whole cents. */
  readonly amountCents?: number
}

export type BillingEntryErrorCode =
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_INTENT'
  | 'UNKNOWN_PRODUCT'
  | 'UNKNOWN_RETURN_TARGET'
  | 'INVALID_AMOUNT'
  | InvalidIdentifierCode

export type BillingEntryResult =
  | { readonly status: 'ok'; readonly entry: BillingEntry }
  | { readonly status: 'error'; readonly code: BillingEntryErrorCode }

type RouteResult =
  | { readonly status: 'ok'; readonly intent: BillingIntent }
  | {
      readonly status: 'error'
      readonly code: 'UNSUPPORTED_VERSION' | 'UNKNOWN_INTENT'
    }

function parseRoute(pathname: string): RouteResult {
  const [version, intent, ...rest] = pathname.split('/').filter(Boolean)
  if (version !== BILLING_CONTRACT_VERSION)
    return { status: 'error', code: 'UNSUPPORTED_VERSION' }
  if (rest.length > 0 || !isBillingIntent(intent))
    return { status: 'error', code: 'UNKNOWN_INTENT' }
  return { status: 'ok', intent }
}

type OptionalFields = OptionalEntryValues &
  Pick<BillingEntry, 'unreadablePromotionCode'>

type OptionalFieldsResult =
  | { readonly status: 'ok'; readonly values: OptionalFields }
  | { readonly status: 'error'; readonly code: InvalidIdentifierCode }

/** A promo code only prefills a field, so an unreadable one is the field's error, not the link's. */
function parseOptionalFields(params: URLSearchParams): OptionalFieldsResult {
  const values: Partial<Record<OptionalEntryKey, string>> = {}
  let unreadablePromotionCode: string | undefined
  for (const field of OPTIONAL_ENTRY_FIELDS) {
    const raw = params.get(field.param)
    if (raw === null) continue
    if (isContractIdentifier(raw)) values[field.key] = raw
    else if (field.key === 'promotionCode') unreadablePromotionCode = raw
    else return { status: 'error', code: field.code }
  }
  return {
    status: 'ok',
    values: {
      ...values,
      ...(unreadablePromotionCode === undefined
        ? {}
        : { unreadablePromotionCode })
    }
  }
}

/**
 * Accepts a full href or the path-and-query form a router hands over. Input
 * that is not a `/v1` billing route at all — a malformed string included —
 * reports `UNSUPPORTED_VERSION`, because from the app's side it is a URL the
 * contract does not describe.
 */
export function parseBillingEntry(url: string | URL): BillingEntryResult {
  const parsed = parseUrl(url, CONTRACT_PARSE_BASE)
  if (!parsed) return { status: 'error', code: 'UNSUPPORTED_VERSION' }

  const route = parseRoute(parsed.pathname)
  if (route.status === 'error') return route

  const product = parsed.searchParams.get(ENTRY_PARAM_PRODUCT)
  if (!isBillingProduct(product))
    return { status: 'error', code: 'UNKNOWN_PRODUCT' }

  const returnTo = parsed.searchParams.get(ENTRY_PARAM_RETURN_TO)
  if (returnTo === null || !isReturnTarget(returnTo))
    return { status: 'error', code: 'UNKNOWN_RETURN_TARGET' }

  const optional = parseOptionalFields(parsed.searchParams)
  if (optional.status === 'error') return optional

  const rawAmount = parsed.searchParams.get(ENTRY_PARAM_AMOUNT)
  const amountCents =
    rawAmount === null ? undefined : readEntryAmountCents(rawAmount)
  if (rawAmount !== null && amountCents === undefined)
    return { status: 'error', code: 'INVALID_AMOUNT' }

  return {
    status: 'ok',
    entry: {
      version: BILLING_CONTRACT_VERSION,
      intent: route.intent,
      product,
      returnTo,
      ...optional.values,
      ...(amountCents === undefined ? {} : { amountCents })
    }
  }
}
