let storesReady: Promise<void> = Promise.resolve()
let resolveStoresReady: (() => void) | undefined

/** Opens the window during which Pinia is not installed into the app yet. */
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
  return storesReady
}
