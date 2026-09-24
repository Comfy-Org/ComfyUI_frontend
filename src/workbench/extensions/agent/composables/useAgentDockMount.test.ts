import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { blankGraph } from '@/scripts/defaultGraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentWorkflowDraftArchiveStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowDraftArchiveStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('@/platform/telemetry'))
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn(() => ({ name: 'DockedAgentPanel' }))
}))
vi.mock<unknown>(
  import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue'),
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
    store.consentAccepted = true
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

  // FE-2911: the panel is behind a persisted open flag, so a user who never
  // opens it still closes chat-bound tabs. Archiving cannot wait for the panel
  // or those graphs are gone before chat asks for them back.
  it('archives a bound unsaved tab closed while the panel stays unmounted', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const graphId = '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c'
    localStorage.setItem(
      'Comfy.Agent.WorkflowTabBindings.v2',
      JSON.stringify({
        'wf-minted': {
          tabPath: 'workflows/Agent draft.json',
          graphId,
          confirmedAt: Date.now()
        }
      })
    )

    const { docked } = useAgentDockMount()

    const workflows = useWorkflowStore()
    const draft = workflows.createTemporary('Agent draft.json', {
      ...blankGraph,
      id: graphId
    })
    workflows.openWorkflowsInBackground({ right: [draft.path] })
    await nextTick()
    await workflows.closeWorkflow(draft)
    await nextTick()

    expect(docked.value).toBe(false)
    expect(useAgentWorkflowDraftArchiveStore().read('wf-minted')).toMatchObject(
      {
        filename: 'Agent draft.json'
      }
    )
  })
})
