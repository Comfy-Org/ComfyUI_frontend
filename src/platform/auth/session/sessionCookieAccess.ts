/** `useSessionCookie().ensureSessionCookie` for the stores `useSessionCookie` depends on. */
export let ensureSessionCookie: () => Promise<void>

/** Called by `authStore` when it loads; `useSessionCookie` itself loads on demand. */
export function provideEnsureSessionCookie(ensure: () => Promise<void>): void {
  ensureSessionCookie = ensure
}
