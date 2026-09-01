import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn(() => ({ name: 'DockedAgentPanel' }))
}))
vi.mock(
  '@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue',
  () => ({ __esModule: true, default: loadDockedAgentPanel() })
)

function getAsyncLoader(component: unknown): () => Promise<unknown> {
  if (
    component === null ||
    typeof component !== 'object' ||
    !('__asyncLoader' in component) ||
    typeof component.__asyncLoader !== 'function'
  ) {
    throw new TypeError('Expected DockedAgentPanel to be an async component')
  }
  return component.__asyncLoader as () => Promise<unknown>
}

describe('useAgentDockMount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('returns an inert mount on non-cloud distributions', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')

    const { mounted, DockedAgentPanel } = useAgentDockMount()

    expect(mounted.value).toBe(false)
    expect(DockedAgentPanel).toBeNull()
  })

  it('mounts for either the visible panel or a compact canvas session', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const store = useAgentPanelStore()

    const composer = useAgentComposerStore()
    const { mounted, DockedAgentPanel } = useAgentDockMount()

    expect(DockedAgentPanel).not.toBeNull()
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(mounted.value).toBe(false)
    store.enabled = true
    expect(mounted.value).toBe(false)
    composer.draft = 'Build on the canvas'
    composer.requestSubmission()
    expect(mounted.value).toBe(true)
    const resolvedPanel = await getAsyncLoader(DockedAgentPanel)()
    const { default: expectedPanel } =
      await import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    expect(resolvedPanel).toBe(expectedPanel)
    expect(loadDockedAgentPanel).toHaveBeenCalledOnce()
    composer.releaseSubmission()
    expect(mounted.value).toBe(false)
    store.isOpen = true
    expect(mounted.value).toBe(true)
    store.close('close_button')
    expect(mounted.value).toBe(false)
  })
})
