import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

describe('useAgentDockMount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('returns an inert mount on non-cloud distributions', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(docked.value).toBe(false)
    expect(DockedAgentPanel).toBeNull()
  })

  it('docks only once the gate enables and the panel opens on cloud', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const store = useAgentPanelStore()

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(DockedAgentPanel).not.toBeNull()
    expect(docked.value).toBe(false)
    store.enabled = true
    expect(docked.value).toBe(false)
    store.isOpen = true
    expect(docked.value).toBe(true)
    store.close('close_button')
    expect(docked.value).toBe(false)
  })
})
