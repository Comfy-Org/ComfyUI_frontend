/**
 * The product side of the contract: turn a billing request into the URL to
 * navigate to. Failures are coded results in the style of the billing core's
 * `BillingResult` — the builder never throws, and a code carries no server or
 * caller text a host could render by accident.
 */
import type { BillingIntent, BillingProduct } from './contract.js'
import { billingIntentPath } from './contract.js'
import type {
  InvalidIdentifierCode,
  OptionalEntryValues
} from './entryFields.js'
import {
  ENTRY_PARAM_PRODUCT,
  ENTRY_PARAM_RETURN_TO,
  OPTIONAL_ENTRY_FIELDS
} from './entryFields.js'
import { isContractIdentifier } from './identifiers.js'
import { isReturnTarget } from './returnTargets.js'
import { parseUrl } from './url.js'

export interface BillingEntryInput extends OptionalEntryValues {
  /** Only the origin is used; any path or query on it is discarded. */
  readonly billingOrigin: string | URL
  readonly intent: BillingIntent
  readonly product: BillingProduct
  /**
   * A `ReturnTarget`. Typed wide because the registry lookup is the real gate:
   * a JavaScript host, or a generic that widened the literal, still has to
   * name a registered target.
   */
  readonly returnTo: string
}

export type BillingEntryUrlErrorCode =
  | 'INVALID_ORIGIN'
  | 'UNKNOWN_RETURN_TARGET'
  | InvalidIdentifierCode

export type BillingEntryUrlResult =
  | { readonly status: 'ok'; readonly url: URL }
  | { readonly status: 'error'; readonly code: BillingEntryUrlErrorCode }

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

function billingOriginHref(origin: string | URL): string | undefined {
  const url = parseUrl(origin)
  if (!url || url.username || url.password) return undefined
  if (url.protocol === 'https:') return url.origin
  if (url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname))
    return url.origin
  return undefined
}

function invalidIdentifierCode(
  values: OptionalEntryValues
): InvalidIdentifierCode | undefined {
  for (const field of OPTIONAL_ENTRY_FIELDS) {
    const value = values[field.key]
    if (value !== undefined && !isContractIdentifier(value)) return field.code
  }
  return undefined
}

export function buildBillingEntryUrl(
  input: BillingEntryInput
): BillingEntryUrlResult {
  const origin = billingOriginHref(input.billingOrigin)
  if (origin === undefined) return { status: 'error', code: 'INVALID_ORIGIN' }

  if (!isReturnTarget(input.returnTo))
    return { status: 'error', code: 'UNKNOWN_RETURN_TARGET' }

  const invalid = invalidIdentifierCode(input)
  if (invalid !== undefined) return { status: 'error', code: invalid }

  const url = new URL(billingIntentPath(input.intent), origin)
  url.searchParams.set(ENTRY_PARAM_PRODUCT, input.product)
  url.searchParams.set(ENTRY_PARAM_RETURN_TO, input.returnTo)
  for (const field of OPTIONAL_ENTRY_FIELDS) {
    const value = input[field.key]
    if (value !== undefined) url.searchParams.set(field.param, value)
  }

  return { status: 'ok', url }
}
