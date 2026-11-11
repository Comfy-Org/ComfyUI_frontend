export function isSafeExtensionBoot(search: string): boolean {
  const value = new URLSearchParams(search).get('safe')
  return value === '' || value === '1' || value === 'true'
}

let safeBootCaptured = false

/** Takes `?safe` out of the URL before the router reads it, so it covers this load only. */
export function captureSafeExtensionBoot(): void {
  const url = new URL(globalThis.location.href)
  safeBootCaptured = isSafeExtensionBoot(url.search)
  if (!safeBootCaptured) return
  url.searchParams.delete('safe')
  globalThis.history.replaceState(globalThis.history.state, '', url)
}

/** Whether this load skips every custom extension. */
export function isSafeExtensionBootActive(): boolean {
  return safeBootCaptured
}
