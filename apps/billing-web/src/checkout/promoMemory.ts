/**
 * The promo code this page applied, kept in the tab's sessionStorage so a
 * reload or a return from a provider's site re-applies it. It is never
 * written to a URL, so a copied link carries only what the link itself did.
 * One record at a time, tagged with the checkout it belongs to: another
 * checkout reads nothing and drops it.
 */
import type { BillingEntry } from '@comfyorg/billing-contract'

import type { PromoEntry } from '@/checkout/promoEntry'

const STORAGE_KEY = 'comfy.billing-web.checkout-promo.v1'

/** Who pays, and for what: a code applied to one checkout belongs to it alone. */
export function checkoutIdentity(
  entry:
    | Pick<BillingEntry, 'product' | 'plan' | 'teamCreditStopId'>
    | undefined,
  workspaceId: string | undefined
): string {
  return JSON.stringify([
    workspaceId ?? null,
    entry?.product ?? null,
    entry?.plan ?? null,
    entry?.teamCreditStopId ?? null
  ])
}

/** A code the server priced for this page, until the customer takes it off. */
export function codeToRemember(entry: PromoEntry): string | undefined {
  return entry.kind === 'applied' || entry.kind === 'removing'
    ? entry.code
    : undefined
}

interface Remembered {
  readonly identity: string
  readonly code: string
}

function isRemembered(value: unknown): value is Remembered {
  return (
    typeof value === 'object' &&
    value !== null &&
    'identity' in value &&
    'code' in value &&
    typeof value.identity === 'string' &&
    typeof value.code === 'string'
  )
}

function parseRemembered(raw: string | null): Remembered | undefined {
  if (raw === null) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    return isRemembered(value) ? value : undefined
  } catch {
    return undefined
  }
}

export interface PromoMemory {
  readonly recall: () => string | undefined
  /** Nothing forgets the code. */
  readonly keep: (code: string | undefined) => void
}

/** A tab without storage, or one that refuses it, remembers nothing and still checks out. */
function withStorage<T>(
  storage: () => Storage,
  use: (store: Storage) => T,
  fallback: T
): T {
  try {
    return use(storage())
  } catch {
    return fallback
  }
}

export function createPromoMemory(
  identity: () => string,
  storage: () => Storage = () => globalThis.sessionStorage
): PromoMemory {
  const forget = () =>
    withStorage(storage, (store) => store.removeItem(STORAGE_KEY), undefined)
  return {
    recall: () => {
      const remembered = withStorage(
        storage,
        (store) => parseRemembered(store.getItem(STORAGE_KEY)),
        undefined
      )
      if (remembered?.identity === identity()) return remembered.code
      if (remembered !== undefined) forget()
      return undefined
    },
    keep: (code) => {
      if (code === undefined) return forget()
      const record: Remembered = { identity: identity(), code }
      withStorage(
        storage,
        (store) => store.setItem(STORAGE_KEY, JSON.stringify(record)),
        undefined
      )
    }
  }
}
