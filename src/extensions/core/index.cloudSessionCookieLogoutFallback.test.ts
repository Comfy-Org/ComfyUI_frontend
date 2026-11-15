import { fromPartial } from '@total-typescript/shoehorn'
import type { WatchHandle } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { useSessionCookie } from '@/platform/auth/session/useSessionCookie'

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

const deleteSession = vi.fn().mockResolvedValue(undefined)
vi.mock(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () =>
    fromPartial<ReturnType<typeof useSessionCookie>>({ deleteSession })
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
  it('still deletes the session cookie and clears the pending OAuth request on logout', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    expect(deleteSession).not.toHaveBeenCalled()
    expect(clearOAuthRequestId).not.toHaveBeenCalled()

    logoutHarness.trigger()

    expect(clearOAuthRequestId).toHaveBeenCalledOnce()
    expect(deleteSession).toHaveBeenCalledOnce()
  })
})
