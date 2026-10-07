import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useProgressTextPreviews } from '@/composables/node/useProgressTextPreviews'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const { api, showTextPreview, removeTextPreview } = vi.hoisted(() => ({
  api: new EventTarget(),
  showTextPreview: vi.fn(),
  removeTextPreview: vi.fn()
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api }))
vi.mock(import('@/composables/node/useNodeProgressText'), () => ({
  useNodeProgressText: vi.fn(() => ({ showTextPreview, removeTextPreview }))
}))

function createWorkflow(path = 'workflows/test.json') {
  return fromPartial<LoadedComfyWorkflow>({
    activeState: { id: 'workflow-id' },
    initialState: { id: 'workflow-id' },
    path
  })
}

function fireProgressText(detail: {
  nodeId: string
  text: string
  prompt_id?: string
}) {
  api.dispatchEvent(new CustomEvent('progress_text', { detail }))
}

function storeActiveJob(workflow: LoadedComfyWorkflow) {
  const executionStore = useExecutionStore()
  executionStore.storeJob({
    nodes: ['1'],
    id: 'job-1',
    promptOutput: {
      '1': { inputs: {}, class_type: 'Node', _meta: { title: 'Node' } }
    },
    workflow,
    mode: 'graph'
  })
  executionStore.activeJobId = 'job-1'
}

describe('useProgressTextPreviews', () => {
  let node: LGraphNode
  let scope: EffectScope

  beforeEach(() => {
    node = createMockLGraphNode({ id: toNodeId(1) })
    scope = effectScope()
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: {
        getNodeById: vi.fn((id: NodeId) => (id === node.id ? node : null))
      }
    })
    vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue('1')
    scope.run(useProgressTextPreviews)
  })

  afterEach(() => {
    scope.stop()
  })

  describe('progress_text events', () => {
    it('shows the text preview on the executing node', () => {
      fireProgressText({ nodeId: '1', text: 'warming up' })

      expect(showTextPreview).toHaveBeenCalledExactlyOnceWith(
        node,
        'warming up'
      )
    })

    it('resolves nested execution ids through the workflow store', () => {
      fireProgressText({ nodeId: '3:1', text: 'warming up' })

      expect(showTextPreview).toHaveBeenCalledExactlyOnceWith(
        node,
        'warming up'
      )
    })

    it('ignores events before the canvas is initialized', () => {
      useCanvasStore().canvas = null

      fireProgressText({ nodeId: '1', text: 'warming up' })

      expect(showTextPreview).not.toHaveBeenCalled()
    })

    it('ignores nested ids that cannot be mapped to the current graph', () => {
      vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue(
        undefined
      )

      fireProgressText({ nodeId: '3:1', text: 'warming up' })

      expect(showTextPreview).not.toHaveBeenCalled()
    })

    it('ignores events for a prompt other than the active job', () => {
      storeActiveJob(createWorkflow())

      fireProgressText({ nodeId: '1', text: 'stale', prompt_id: 'job-9' })

      expect(showTextPreview).not.toHaveBeenCalled()
    })
  })

  describe('job reset', () => {
    it('removes text previews from the nodes of a job in the active workflow', () => {
      const workflow = createWorkflow()
      useWorkflowStore().activeWorkflow = workflow
      storeActiveJob(workflow)

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).toHaveBeenCalledExactlyOnceWith(node)
    })

    it('preserves text previews when the job ran in another workflow', () => {
      useWorkflowStore().activeWorkflow = createWorkflow('workflows/other.json')
      storeActiveJob(createWorkflow('workflows/finished.json'))

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).not.toHaveBeenCalled()
    })

    it('preserves text previews when the node is outside the viewed subgraph', () => {
      const workflow = createWorkflow()
      useWorkflowStore().activeWorkflow = workflow
      storeActiveJob(workflow)
      vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue(
        undefined
      )

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).not.toHaveBeenCalled()
    })
  })

  describe('scope disposal', () => {
    it('stops updating text previews once the scope is disposed', () => {
      const workflow = createWorkflow()
      useWorkflowStore().activeWorkflow = workflow
      storeActiveJob(workflow)
      scope.stop()

      fireProgressText({ nodeId: '1', text: 'warming up' })
      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(showTextPreview).not.toHaveBeenCalled()
      expect(removeTextPreview).not.toHaveBeenCalled()
    })
  })
})
