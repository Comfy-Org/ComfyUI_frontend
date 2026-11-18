import { fromPartial } from '@total-typescript/shoehorn'
import type { WatchHandle } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { useCurrentUser } from '@/composables/auth/useCurrentUser'

vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: true
}))
vi.mock(import('./cloudSessionCookie'), () =>
  Promise.reject(new Error('chunk fetch failed'))
)

const logoutHarness = vi.hoisted(() => {
  let callback: (() => void) | undefined
  return {
    register: (next: () => void) => {
      callback = next
    },
    trigger: () => callback?.()
  }
})

vi.mock(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () =>
    fromPartial<ReturnType<typeof useCurrentUser>>({
      onUserLogout: (callback: () => void): WatchHandle => {
        logoutHarness.register(callback)
        const stop = () => {}
        return Object.assign(stop, { stop, pause: vi.fn(), resume: vi.fn() })
      }
    })
}))

const clearOAuthRequestId = vi.fn()
vi.mock(import('@/platform/cloud/oauth/oauthState'), () => ({
  clearOAuthRequestId
}))

await Promise.all(
  Object.values(
    import.meta.glob([
      './cloud*.ts',
      '!./*.test.ts',
      '!./cloudSessionCookie.ts'
    ])
  ).map((load) => load())
)
const { registerCoreExtensions } = await import('./index')

describe('cloud session cookie logout fallback when the extension fails to load', () => {
  it('still clears the pending OAuth request on logout and sends no session request', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    expect(clearOAuthRequestId).not.toHaveBeenCalled()

    logoutHarness.trigger()
    await vi.runAllTimersAsync()

    expect(clearOAuthRequestId).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })
})
