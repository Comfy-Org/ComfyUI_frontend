import { expect, it, vi } from 'vitest'

import {
  ACCOUNT_SOURCE_CAP_MS,
  resolveWorkshopAccountSource
} from './workshop-account-source'

const identityModule = vi.hoisted(() => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const identity = {
    getState: () => ({ phase: 'idle' as const }),
    subscribe: vi.fn(() => () => {}),
    boot: vi.fn(),
    dispose: vi.fn()
  }
  return { arrives: promise, release: resolve, identity }
})

vi.mock(import('@comfyorg/account-core/webSessionIdentity'), async () => {
  await identityModule.arrives
  return { createWebSessionIdentity: () => identityModule.identity }
})
vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-firebase'))

it('never boots a session whose module arrives after the cap', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (_input, init = {}) =>
      Response.json(
        init.credentials === 'include'
          ? { unified_web_session: true }
          : { web_session_probe: true }
      )
    )
  )
  vi.useFakeTimers({ shouldAdvanceTime: false })

  const source = resolveWorkshopAccountSource()
  await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS)
  expect(await source).toBe('firebase')

  identityModule.release()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(identityModule.identity.boot).not.toHaveBeenCalled()
})
