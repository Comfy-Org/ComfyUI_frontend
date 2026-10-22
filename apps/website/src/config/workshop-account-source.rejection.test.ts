import { expect, it, vi } from 'vitest'

import { resolveWorkshopAccountSource } from './workshop-account-source'

vi.mock(import('./workshop-web-session'), () => ({
  readUnifiedWebSessionEnabled: async () => true
}))
vi.mock(import('./workshop-web-session-identity'), () => {
  throw new Error('chunk failed to load')
})

it('falls back to Firebase before the cap when the session module fails to load', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false })

  const settled = vi.fn()
  void resolveWorkshopAccountSource().then(settled)
  await vi.advanceTimersByTimeAsync(0)

  expect(settled).toHaveBeenCalledWith('firebase')
})
