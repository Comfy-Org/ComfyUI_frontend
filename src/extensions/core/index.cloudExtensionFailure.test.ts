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
vi.mock(import('./cloudRemoteConfig'), () => ({
  cloudRemoteConfigExtension: undefined
}))
vi.mock(import('./cloudFeedbackTopbarButton'), () => ({
  feedbackButtonExtension: undefined
}))

await Promise.all(
  Object.values(import.meta.glob(['./cloud*.ts', '!./*.test.ts'])).map((load) =>
    load()
  )
)
const { registerCoreExtensions } = await import('./index')

describe('cloud core extensions when a chunk import resolves without its export', () => {
  it('skips the broken extensions, keeps the rest, and reports each failure', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    const names = useExtensionStore().extensions.map(({ name }) => name)
    expect(names).not.toContain('Comfy.Cloud.RemoteConfig')
    expect(names).not.toContain('Comfy.FeedbackButton')
    expect(names).toContain('Comfy.Cloud.Badges')
    expect(names).toContain('Comfy.Cloud.SessionCookie')
    expect(names).toContain('Comfy.AgentPanel')

    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      surface: 'platform',
      errorType: 'error_loading_cloud_remote_config_extension'
    })
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      surface: 'workspace',
      errorType: 'error_loading_feedback_button_extension'
    })
  })
})
