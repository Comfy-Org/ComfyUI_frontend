import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentCanvasEntryMount } from './useAgentCanvasEntryMount'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

describe('useAgentCanvasEntryMount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('returns an inert mount on non-cloud distributions', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')

    const mount = useAgentCanvasEntryMount()

    expect(mount.enabled.value).toBe(false)
    expect(mount.CompactAgentComposer).toBeNull()
    expect(mount.AgentGraphBuildPlaybackOverlay).toBeNull()
  })

  it('follows the Agent feature gate on cloud', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const store = useAgentPanelStore()

    const mount = useAgentCanvasEntryMount()

    expect(mount.CompactAgentComposer).not.toBeNull()
    expect(mount.AgentGraphBuildPlaybackOverlay).not.toBeNull()
    expect(mount.enabled.value).toBe(false)
    store.enabled = true
    expect(mount.enabled.value).toBe(true)
  })
})
