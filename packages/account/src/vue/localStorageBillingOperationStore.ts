import type { BillingOperationStore, Namespace } from '../core/index.js'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export function createLocalStorageBillingOperationStore(
  namespace: Namespace,
  storage: StorageLike
): BillingOperationStore {
  const key = `${namespace}:billing:active-operation`
  return {
    namespace,
    async getActiveId() {
      return storage.getItem(key)
    },
    async setActiveId(id: string) {
      storage.setItem(key, id)
    },
    async clearActiveId() {
      storage.removeItem(key)
    }
  }
}
