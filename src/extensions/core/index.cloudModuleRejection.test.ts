import { describe, expect, it, vi } from 'vitest'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { reportError } from '@comfyorg/telemetry/reportError'

vi.mock(import('@/composables/auth/useCurrentUser'))
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

describe('cloud core extensions when a chunk import rejects', () => {
  it('skips the broken extension, keeps the rest, and reports the failure', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    const names = useExtensionStore().extensions.map(({ name }) => name)
    expect(names).not.toContain('Comfy.Cloud.SessionCookie')
    expect(names).toContain('Comfy.Cloud.RemoteConfig')
    expect(names).toContain('Comfy.Cloud.Badges')
    expect(names).toContain('Comfy.AgentPanel')
    expect(names).toContain('Comfy.FeedbackButton')

    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      surface: 'auth',
      errorType: 'error_loading_cloud_session_cookie_extension'
    })
  })
})
