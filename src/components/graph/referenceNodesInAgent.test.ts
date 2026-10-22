import { describe, expect, it, vi } from 'vitest'

import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
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

describe('referenceNodesInAgent', () => {
  it('does nothing when the agent is unavailable', () => {
    const node = createNode(1, 'KSampler')
    setCanvasSelection([node])
    const panel = useAgentPanelStore()
    panel.enabled = false
    panel.isOpen = false

    expect(referenceNodesInAgent([node.id])).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(useAgentComposerStore().nodes).toEqual([])
  })

  it('does nothing when none of the ids resolve to graph nodes', () => {
    const { panel, composer } = enableAgentWithWorkflow()
    setCanvasSelection([])

    expect(referenceNodesInAgent([toNodeId(99)])).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(composer.nodes).toEqual([])
  })

  it('does nothing when there is no active workflow', () => {
    const node = createNode(1, 'KSampler')
    setCanvasSelection([node])
    const panel = useAgentPanelStore()
    panel.enabled = true
    useWorkflowStore().activeWorkflow = null

    expect(referenceNodesInAgent([node.id])).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(useAgentComposerStore().nodes).toEqual([])
  })

  it('opens a closed panel and adds one chip per requested node', () => {
    const ksampler = createNode(5, 'KSampler')
    const decode = createNode(8, 'VAE Decode')
    setCanvasSelection([ksampler, decode])
    const { panel, workflow, composer } = enableAgentWithWorkflow()

    expect(referenceNodesInAgent([ksampler.id, decode.id])).toBe(true)
    expect(panel.isOpen).toBe(true)
    expect(panel.selectedWorkflow?.path).toBe(workflow.path)
    expect(panel.selectedWorkflow?.instanceId).toBe(workflow.instanceId)
    expect(composer.nodeScope).toBe(workflow.instanceId)
    expect(composer.nodes).toEqual([
      {
        id: '5',
        locatorId: '5',
        title: 'KSampler'
      },
      {
        id: '8',
        locatorId: '8',
        title: 'VAE Decode'
      }
    ])
    expect(composer.draft.trim()).toBe('')
    expect(composer.submission).toBeNull()
    expect(useTelemetry()?.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'selection_toolbox'
    })
  })

  it('keeps an already-open panel open and does not send', () => {
    const node = createNode(3, 'CLIP Text Encode')
    setCanvasSelection([node])
    const { panel, composer } = enableAgentWithWorkflow()
    panel.isOpen = true
    vi.mocked(useTelemetry()!.trackAgentPanelOpened).mockClear()

    expect(referenceNodesInAgent([node.id])).toBe(true)
    expect(panel.isOpen).toBe(true)
    expect(composer.nodes).toEqual([
      {
        id: '3',
        locatorId: '3',
        title: 'CLIP Text Encode'
      }
    ])
    expect(composer.submission).toBeNull()
    expect(useTelemetry()?.trackAgentPanelOpened).not.toHaveBeenCalled()
  })

  it('merges new chips without duplicating ones already in the composer', () => {
    const first = createNode(1, 'Load Checkpoint')
    const second = createNode(2, 'KSampler')
    setCanvasSelection([first, second])
    const { composer } = enableAgentWithWorkflow()

    referenceNodesInAgent([first.id])
    referenceNodesInAgent([first.id, second.id])

    expect(composer.nodes.map((node) => node.id)).toEqual(['1', '2'])
  })

  it('leaves typed prompt text in place and still does not send', () => {
    const node = createNode(4, 'Save Image')
    setCanvasSelection([node])
    const { composer } = enableAgentWithWorkflow()
    composer.setText('explain this node')

    referenceNodesInAgent([node.id])

    expect(composer.draft).toContain('explain this node')
    expect(composer.submission).toBeNull()
  })

  it('resolves ids from the current graph when the nodes are not selected', () => {
    const node = createNode(12, 'Source node')
    const graph = new LGraph()
    graph.add(node)
    useCanvasStore().currentGraph = graph
    setCanvasSelection([])
    const { composer } = enableAgentWithWorkflow()

    expect(referenceNodesInAgent([node.id])).toBe(true)
    expect(composer.nodes).toEqual([
      {
        id: String(node.id),
        locatorId: String(node.id),
        title: 'Source node'
      }
    ])
  })
})
