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
vi.mock(import('./agentPanel'), () => ({
  registerAgentPanelExtension: undefined
}))

await Promise.all(
  Object.values(import.meta.glob(['./cloud*.ts', '!./*.test.ts'])).map((load) =>
    load()
  )
)
const { registerCoreExtensions } = await import('./index')

describe('cloud core extensions when the Agent panel cannot load', () => {
  it('keeps loading the remaining extensions and reports the failure', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    await registerCoreExtensions()

    const names = useExtensionStore().extensions.map(({ name }) => name)
    expect(names).not.toContain('Comfy.AgentPanel')
    expect(names.at(-1)).toBe('Comfy.FeedbackButton')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(TypeError), {
      surface: 'agent',
      errorType: 'error_loading_agent_panel_extension'
    })
  })
})
