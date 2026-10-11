import { getActivePinia } from 'pinia'

/** Gates store-backed telemetry setup until `main.ts` installs Pinia. */
let storesReady: Promise<void> = Promise.resolve()
let resolveStoresReady: (() => void) | undefined

/** Opens the window during which no Pinia instance is installed yet. */
export function markStoresPending(): void {
  if (resolveStoresReady) return
  storesReady = new Promise<void>((resolve) => {
    resolveStoresReady = resolve
  })
}

/** Closes the window opened by {@link markStoresPending}. */
export function markStoresReady(): void {
  resolveStoresReady?.()
  resolveStoresReady = undefined
  storesReady = Promise.resolve()
}

/** Resolves once store-backed composables are safe to call. */
export function whenStoresReady(): Promise<void> {
  return getActivePinia() ? Promise.resolve() : storesReady
}
