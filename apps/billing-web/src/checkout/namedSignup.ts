import type { BillingEntry } from '@comfyorg/billing-contract'
import { ENTRY_PARAM_OPERATION } from '@comfyorg/billing-contract'

const STORAGE_KEY = 'comfy.billing-web.replaced-signups.v1'

type NamedEntry = Pick<BillingEntry, 'operationId'> | undefined

function parseIds(raw: string | null): string[] {
  if (raw === null) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

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

interface Address {
  readonly location: { readonly href: string }
  readonly history: Pick<History, 'state' | 'replaceState'>
}

function dropOperationFromAddress(page: Address) {
  const address = new URL(page.location.href)
  if (!address.searchParams.has(ENTRY_PARAM_OPERATION)) return
  address.searchParams.delete(ENTRY_PARAM_OPERATION)
  page.history.replaceState(page.history.state, '', address)
}

/**
 * The unfinished signup a checkout link names, followed until this tab pays
 * in its place, and only where the tab can remember that it did.
 */
export function createNamedSignup(
  storage: () => Storage = () => globalThis.sessionStorage,
  page: Address = globalThis.window
) {
  const replacedHere = new Set<string>()

  function isReplaced(id: string) {
    return (
      replacedHere.has(id) ||
      withStorage(
        storage,
        (store) => parseIds(store.getItem(STORAGE_KEY)).includes(id),
        true
      )
    )
  }

  return {
    recoverOptions(entry: NamedEntry) {
      const id = entry?.operationId
      return id === undefined || isReplaced(id)
        ? {}
        : { operation: { id, kind: 'subscription' as const } }
    },
    replaced(entry: NamedEntry) {
      const id = entry?.operationId
      if (id === undefined) return
      replacedHere.add(id)
      dropOperationFromAddress(page)
      withStorage(
        storage,
        (store) => {
          const ids = new Set(parseIds(store.getItem(STORAGE_KEY))).add(id)
          store.setItem(STORAGE_KEY, JSON.stringify([...ids]))
        },
        undefined
      )
    }
  }
}
