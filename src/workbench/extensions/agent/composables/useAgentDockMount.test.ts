import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn(() => ({ name: 'DockedAgentPanel' }))
}))
vi.mock(
  '@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue',
  () => ({ default: loadDockedAgentPanel() })
)

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

  it('docks only once the gate enables and the panel opens on cloud', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const store = useAgentPanelStore()

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(DockedAgentPanel).not.toBeNull()
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(docked.value).toBe(false)
    store.enabled = true
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(docked.value).toBe(false)
    store.isOpen = true
    expect(docked.value).toBe(true)
    await (
      DockedAgentPanel as { __asyncLoader: () => Promise<unknown> }
    ).__asyncLoader()
    expect(loadDockedAgentPanel).toHaveBeenCalledOnce()
    store.close('close_button')
    expect(docked.value).toBe(false)
  })
})
