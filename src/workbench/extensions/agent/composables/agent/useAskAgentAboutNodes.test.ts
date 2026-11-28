import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  createMockLGraphNode,
  createMockLoadedWorkflow
} from '@/utils/__tests__/litegraphTestUtils'
import type { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAskAgentAboutNodes } from './useAskAgentAboutNodes'

const consent = vi.hoisted(() => ({
  withConsent: vi.fn<ReturnType<typeof useAgentConsent>['withConsent']>()
}))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => ({
    useAgentConsent: () => ({
      accepted: computed(() => true),
      isChecking: computed(() => false),
      withConsent: consent.withConsent,
      resumeAcceptAfterReload: vi.fn(() => Promise.resolve())
    })
  })
)

const KSAMPLER = createMockLGraphNode({
  id: toNodeId(7),
  title: 'KSampler',
  type: 'KSampler'
})
const VAE_DECODE = createMockLGraphNode({
  id: toNodeId(8),
  title: '',
  type: 'VAEDecode'
})

describe('useAskAgentAboutNodes', () => {
  beforeEach(() => {
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      onAccept()
    })
    const workflowStore = useWorkflowStore()
    Object.defineProperty(workflowStore, 'activeWorkflow', {
      configurable: true,
      value: createMockLoadedWorkflow({
        path: 'workflows/current.json',
        instanceId: 'wf-instance-1'
      })
    })
    vi.spyOn(workflowStore, 'nodeToNodeLocatorId').mockImplementation(
      (node) =>
        `root:${node.id}` as ReturnType<
          typeof workflowStore.nodeToNodeLocatorId
        >
    )
  })

  it('opens a closed panel on the chat and hands it the question with the nodes', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const activeWorkflow = useWorkflowStore().activeWorkflow!
    const { askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes('  What does this node do? ', [
      KSAMPLER,
      VAE_DECODE
    ])

    expect(consent.withConsent).toHaveBeenCalledWith(
      'button_click',
      expect.any(Function)
    )
    expect(panel.isOpen).toBe(true)
    expect(panel.view).toEqual({ screen: 'chat' })
    expect(panel.pendingNodeAsk).toEqual({
      text: 'What does this node do?',
      nodes: [
        { id: '7', locatorId: 'root:7', title: 'KSampler' },
        { id: '8', locatorId: 'root:8', title: 'VAEDecode' }
      ],
      workflowPath: 'workflows/current.json',
      workflowInstanceId: activeWorkflow.instanceId,
      inputMethod: 'selection_toolbox'
    })
  })

  it('records suggestion input method for example prompts', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.open('topbar_button')
    const { askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes(
      'Explain these settings',
      [KSAMPLER],
      'selection_toolbox_suggestion'
    )

    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(panel.pendingNodeAsk).toMatchObject({
      text: 'Explain these settings',
      inputMethod: 'selection_toolbox_suggestion'
    })
  })

  it('does nothing when the agent is unavailable', async () => {
    const panel = useAgentPanelStore()
    const { canAskAgent, askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes('What does this node do?', [KSAMPLER])

    expect(canAskAgent.value).toBe(false)
    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(panel.isOpen).toBe(false)
    expect(panel.pendingNodeAsk).toBeNull()
  })

  it.for([
    { label: 'an empty question', text: '   ', nodes: [KSAMPLER] },
    {
      label: 'an empty selection',
      text: 'What does this node do?',
      nodes: []
    }
  ])('ignores $label', async ({ text, nodes }) => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const { askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes(text, nodes)

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingNodeAsk).toBeNull()
  })

  it('ignores the ask when a different workflow instance opens at the same path during consent', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const workflowStore = useWorkflowStore()
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      Object.defineProperty(workflowStore, 'activeWorkflow', {
        configurable: true,
        value: createMockLoadedWorkflow({
          path: 'workflows/current.json',
          instanceId: 'wf-instance-2'
        })
      })
      onAccept()
    })
    const { askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes('What does this node do?', [KSAMPLER])

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingNodeAsk).toBeNull()
  })

  it('leaves the panel closed when consent is declined', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    consent.withConsent.mockResolvedValue(undefined)
    const { askAgentAboutNodes } = useAskAgentAboutNodes()

    await askAgentAboutNodes('What does this node do?', [KSAMPLER])

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingNodeAsk).toBeNull()
  })
})
