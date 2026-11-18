import type { BillingEntry } from '@comfyorg/billing-contract'

const STORAGE_KEY = 'comfy.billing-web.replaced-signup.v1'

type NamedEntry = Pick<BillingEntry, 'operationId'> | undefined

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

/**
 * The unfinished signup a checkout link names, followed until this tab pays
 * in its place; from then on recovery follows whatever the server reports.
 */
export function createNamedSignup(
  storage: () => Storage = () => globalThis.sessionStorage
) {
  const replacedHere = new Set<string>()

  function isReplaced(id: string) {
    return (
      replacedHere.has(id) ||
      withStorage(storage, (store) => store.getItem(STORAGE_KEY) === id, false)
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
      withStorage(storage, (store) => store.setItem(STORAGE_KEY, id), undefined)
    }
  }
}
