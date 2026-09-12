import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('@/platform/telemetry'), () => ({ useTelemetry: () => null }))
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn()
}))
const CRDT_DOC_ID_KEY = 'Comfy.Agent.CrdtDocId'
vi.mock(
  import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue'),
  () => {
    loadDockedAgentPanel()
    return { default: defineComponent({ name: 'DockedAgentPanel' }) }
  }
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
    const store = useAgentPanelStore()
    store.enabled = false
    store.isOpen = false
    store.gateSettled = false
    localStorage.clear()
    sessionStorage.clear()
  })

  it('returns an inert mount on non-cloud distributions', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
    const inheritedRecord = JSON.stringify({
      docId: 'wf-from-another-tab',
      nonce: 'foreign-page',
      expiresAt: Date.now() + 60_000
    })
    sessionStorage.setItem(CRDT_DOC_ID_KEY, inheritedRecord)

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(docked.value).toBe(false)
    expect(DockedAgentPanel).toBeNull()
    expect(sessionStorage.getItem(CRDT_DOC_ID_KEY)).toBe(inheritedRecord)
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
    const resolvedModule = await getAsyncLoader(DockedAgentPanel)()
    const expectedModule =
      await import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    expect(resolvedModule).toBe(expectedModule)
    expect(expectedModule.default.name).toBe('DockedAgentPanel')
    expect(loadDockedAgentPanel).toHaveBeenCalledOnce()
    store.close('close_button')
    expect(docked.value).toBe(false)
  })

  it('consumes an inherited CRDT binding before the cloud panel opens', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    sessionStorage.setItem(
      CRDT_DOC_ID_KEY,
      JSON.stringify({
        docId: 'wf-from-another-tab',
        nonce: 'foreign-page',
        expiresAt: Date.now() + 60_000
      })
    )

    const { docked } = useAgentDockMount()

    expect(docked.value).toBe(false)
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(CRDT_DOC_ID_KEY)).toBeNull()
  })
})
