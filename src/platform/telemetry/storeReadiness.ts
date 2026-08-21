import { getActivePinia } from 'pinia'

/**
 * Telemetry providers are constructed from `initTelemetry()`, which `main.ts`
 * awaits *before* it creates the Vue app and installs Pinia. Their
 * dynamic-import continuations therefore race plugin installation: when the
 * vendor chunk is warm in the HTTP cache the continuation wins, and a
 * store-backed composable it calls reaches Pinia's `useStore` with no active
 * instance. Pinia's production build has the readable dev-only guard compiled
 * out and dereferences `undefined` instead — the `Cannot read properties of
 * undefined (reading '_s')` all three loaders report.
 *
 * Defaults to *ready* so unit tests are never gated on a signal only `main.ts`
 * sends.
 */
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
