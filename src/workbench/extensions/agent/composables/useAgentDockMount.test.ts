import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn(() => ({ name: 'DockedAgentPanel' }))
}))
const CRDT_DOC_ID_KEY = 'Comfy.Agent.CrdtDocId'
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
    const resolvedPanel = await getAsyncLoader(DockedAgentPanel)()
    const { default: expectedPanel } =
      await import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    expect(resolvedPanel).toBe(expectedPanel)
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
