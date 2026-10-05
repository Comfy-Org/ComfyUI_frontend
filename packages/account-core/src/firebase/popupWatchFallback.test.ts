import { describe, expect, it, vi } from 'vitest'

/** A Firebase build whose popup resolver is not a class this can extend. */
const sdk = vi.hoisted(() => ({ browserPopupRedirectResolver: {} }))

vi.mock<unknown>(import('firebase/auth'), () => ({
  browserPopupRedirectResolver: sdk.browserPopupRedirectResolver
}))

describe('the popup watch on a resolver it cannot extend', () => {
  it('uses Firebase’s own resolver and runs sign-in unwatched, instead of failing to load', async () => {
    const { runWatchedPopup, watchedPopupRedirectResolver } =
      await import('./popupWatch.js')
    const onAbandoned = vi.fn()

    expect(watchedPopupRedirectResolver).toBe(sdk.browserPopupRedirectResolver)
    await expect(
      runWatchedPopup({}, async () => 'signed-in', { onAbandoned })
    ).resolves.toBe('signed-in')
    expect(onAbandoned).not.toHaveBeenCalled()
  })
})
