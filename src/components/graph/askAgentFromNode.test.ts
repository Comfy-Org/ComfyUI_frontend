import { describe, expect, it, vi } from 'vitest'

import {
  fillNodeAskAgentPrompt,
  sendNodeAskAgentPrompt
} from '@/components/graph/askAgentFromNode'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/platform/telemetry'))

function createNode(id: number, title: string): LGraphNode {
  const node = new LGraphNode(title)
  node.id = toNodeId(id)
  return node
}

function enableAgentWithWorkflow() {
  const panel = useAgentPanelStore()
  const workflow = createMockLoadedWorkflow({
    path: 'workflows/a.json',
    instanceId: 'instance-a'
  })
  useWorkflowStore().activeWorkflow = workflow
  panel.enabled = true
  panel.isOpen = false
  return { panel, workflow, composer: useAgentComposerStore() }
}

describe('fillNodeAskAgentPrompt', () => {
  it('opens a closed panel, adds the chip and prompt, and does not send', () => {
    const node = createNode(7, 'KSampler')
    setCanvasSelection([node])
    const { panel, composer } = enableAgentWithWorkflow()

    expect(fillNodeAskAgentPrompt(node.id, 'Explain this node for me')).toBe(
      true
    )
    expect(panel.isOpen).toBe(true)
    expect(composer.nodes).toEqual([
      {
        id: '7',
        locatorId: '7',
        title: 'KSampler'
      }
    ])
    expect(composer.draft).toBe('Explain this node for me')
    expect(composer.submission).toBeNull()
    expect(composer.submitRequestId).toBe(0)
    expect(useTelemetry()?.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'node_hover'
    })
  })

  it('does nothing when the agent is unavailable', () => {
    const node = createNode(1, 'KSampler')
    setCanvasSelection([node])
    const panel = useAgentPanelStore()
    panel.enabled = false
    panel.isOpen = false

    expect(fillNodeAskAgentPrompt(node.id, 'Explain this node for me')).toBe(
      false
    )
    expect(panel.isOpen).toBe(false)
    expect(useAgentComposerStore().draft).toBe('')
    expect(useAgentComposerStore().submitRequestId).toBe(0)
  })
})

describe('sendNodeAskAgentPrompt', () => {
  it('opens a closed panel, adds the chip and prompt, and requests send', () => {
    const node = createNode(4, 'VAE Decode')
    const graph = new LGraph()
    graph.add(node)
    useCanvasStore().currentGraph = graph
    setCanvasSelection([])
    const { panel, composer } = enableAgentWithWorkflow()

    expect(sendNodeAskAgentPrompt(node.id, 'Add an output that matches')).toBe(
      true
    )
    expect(panel.isOpen).toBe(true)
    expect(composer.nodes).toEqual([
      {
        id: String(node.id),
        locatorId: String(node.id),
        title: 'VAE Decode'
      }
    ])
    expect(composer.draft).toBe('Add an output that matches')
    expect(composer.submission).toBeNull()
    expect(composer.submitRequestId).toBe(1)
    expect(useTelemetry()?.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'node_hover'
    })
  })

  it('does not send blank text', () => {
    const node = createNode(2, 'CLIP Text Encode')
    setCanvasSelection([node])
    const { panel, composer } = enableAgentWithWorkflow()

    expect(sendNodeAskAgentPrompt(node.id, '   ')).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(composer.nodes).toEqual([])
    expect(composer.submitRequestId).toBe(0)
  })
})
