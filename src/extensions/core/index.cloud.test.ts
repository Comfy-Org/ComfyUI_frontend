import { describe, expect, it, vi } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: true
}))

await Promise.all(
  Object.values(import.meta.glob(['./cloud*.ts', '!./*.test.ts'])).map((load) =>
    load()
  )
)
const { registerCoreExtensions } = await import('./index')

describe('core extensions in a nightly cloud build', () => {
  it('skip node templates and register the cloud extensions and feedback button after the agent panel', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    const names = useExtensionStore().extensions.map(({ name }) => name)
    expect(names).not.toContain('Comfy.NodeTemplates')
    expect(names.slice(-5)).toEqual([
      'Comfy.Cloud.RemoteConfig',
      'Comfy.Cloud.Badges',
      'Comfy.Cloud.SessionCookie',
      'Comfy.AgentPanel',
      'Comfy.FeedbackButton'
    ])
  })
})
