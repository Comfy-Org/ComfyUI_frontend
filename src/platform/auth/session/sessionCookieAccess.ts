import { assert } from '@/base/assert'

let providedEnsureSessionCookie: (() => Promise<void>) | undefined

/** Called by `authStore` when it loads; `useSessionCookie` itself loads on demand. */
export function provideEnsureSessionCookie(ensure: () => Promise<void>): void {
  providedEnsureSessionCookie = ensure
}

/** `useSessionCookie().ensureSessionCookie` for the stores `useSessionCookie` depends on. */
export function ensureSessionCookie(): Promise<void> {
  assert(
    providedEnsureSessionCookie,
    'authStore has not provided ensureSessionCookie'
  )
  return providedEnsureSessionCookie()
}
