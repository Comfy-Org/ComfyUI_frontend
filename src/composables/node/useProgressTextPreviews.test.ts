import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { useProgressTextPreviews } from '@/composables/node/useProgressTextPreviews'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { ProgressTextWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const { showTextPreview, removeTextPreview } = vi.hoisted(() => ({
  showTextPreview: vi.fn(),
  removeTextPreview: vi.fn()
}))

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/node/useNodeProgressText'), () => ({
  useNodeProgressText: vi.fn(() => ({ showTextPreview, removeTextPreview }))
}))

function mountPreviews() {
  const scope = effectScope()
  scope.run(useProgressTextPreviews)
  onTestFinished(() => scope.stop())
  return scope
}

function showCanvasNode() {
  const node = createMockLGraphNode({ id: toNodeId(1) })
  useCanvasStore().canvas = fromPartial<LGraphCanvas>({
    graph: {
      getNodeById: vi.fn((id: NodeId) => (id === node.id ? node : null))
    }
  })
  vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue('1')
  return node
}

function createWorkflow(path = 'workflows/test.json', id = 'workflow-id') {
  return fromPartial<LoadedComfyWorkflow>({
    activeState: { id },
    initialState: { id },
    path,
    // The only identifier unique per open tab, and the strongest leg of the
    // ownership gate this suite now goes through.
    instanceId: `instance-${path}`
  })
}

function progressTextListener() {
  const registration = vi
    .mocked(api.addEventListener)
    .mock.calls.find(([type]) => type === 'progress_text')
  assert.exists(registration)
  const [, listener] = registration
  assert.exists(listener)
  return listener
}

function fireProgressText(detail: ProgressTextWsMessage) {
  progressTextListener()(new CustomEvent('progress_text', { detail }))
}

/**
 * Queue a job from `workflow` without making it the active job, which is what a
 * run started while another tab was in front looks like.
 */
function storeBackgroundJob(jobId: string, workflow: LoadedComfyWorkflow) {
  useExecutionStore().storeJob({
    nodes: ['1'],
    id: jobId,
    promptOutput: {
      '1': { inputs: {}, class_type: 'Node', _meta: { title: 'Node' } }
    },
    workflow,
    mode: 'graph'
  })
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
  describe('progress_text events', () => {
    it('shows the text preview on the executing node', () => {
      const node = showCanvasNode()
      mountPreviews()

      fireProgressText({ nodeId: toNodeId('1'), text: 'warming up' })

      expect(showTextPreview).toHaveBeenCalledExactlyOnceWith(
        node,
        'warming up'
      )
    })

    it('resolves nested execution ids through the workflow store', () => {
      const node = showCanvasNode()
      mountPreviews()

      fireProgressText({ nodeId: toNodeId('3:1'), text: 'warming up' })

      expect(showTextPreview).toHaveBeenCalledExactlyOnceWith(
        node,
        'warming up'
      )
    })

    it('ignores events before the canvas is initialized', () => {
      mountPreviews()

      fireProgressText({ nodeId: toNodeId('1'), text: 'warming up' })

      expect(showTextPreview).not.toHaveBeenCalled()
    })

    it('ignores nested ids that cannot be mapped to the current graph', () => {
      showCanvasNode()
      vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue(
        undefined
      )
      mountPreviews()

      fireProgressText({ nodeId: toNodeId('3:1'), text: 'warming up' })

      expect(showTextPreview).not.toHaveBeenCalled()
    })

    // Ported from executionStore.workflowGating.test.ts when handleProgressText
    // moved into this composable. The gate is ownership-based, not a bare
    // activeJobId comparison, because activeJobId can name another tab's job.
    it('drops text from a job belonging to another open workflow', () => {
      showCanvasNode()
      const visible = createWorkflow('workflows/a.json', 'workflow-a')
      const other = createWorkflow('workflows/b.json', 'workflow-b')
      useWorkflowStore().activeWorkflow = visible
      storeBackgroundJob('job-b', other)
      mountPreviews()

      fireProgressText({
        nodeId: toNodeId('1'),
        text: 'from the other tab',
        prompt_id: 'job-b'
      })

      expect(showTextPreview).not.toHaveBeenCalled()
    })

    it('shows text from the visible workflow own background job', () => {
      const node = showCanvasNode()
      const visible = createWorkflow('workflows/a.json', 'workflow-a')
      useWorkflowStore().activeWorkflow = visible
      // Owned by the tab in front but not the active job, which is what the
      // old activeJobId-only guard dropped.
      storeBackgroundJob('job-a', visible)
      mountPreviews()

      fireProgressText({
        nodeId: toNodeId('1'),
        text: 'mine',
        prompt_id: 'job-a'
      })

      expect(showTextPreview).toHaveBeenCalledExactlyOnceWith(node, 'mine')
    })

    it('ignores events for a prompt other than the active job', () => {
      showCanvasNode()
      storeActiveJob(createWorkflow())
      mountPreviews()

      fireProgressText({
        nodeId: toNodeId('1'),
        text: 'stale',
        prompt_id: 'job-9'
      })

      expect(showTextPreview).not.toHaveBeenCalled()
    })
  })

  describe('job reset', () => {
    it('removes text previews from the nodes of a job in the active workflow', () => {
      const node = showCanvasNode()
      const workflow = createWorkflow()
      useWorkflowStore().activeWorkflow = workflow
      storeActiveJob(workflow)
      mountPreviews()

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).toHaveBeenCalledExactlyOnceWith(node)
    })

    it('preserves text previews when the job ran in another workflow', () => {
      showCanvasNode()
      useWorkflowStore().activeWorkflow = createWorkflow('workflows/other.json')
      storeActiveJob(createWorkflow('workflows/finished.json'))
      mountPreviews()

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).not.toHaveBeenCalled()
    })

    it('preserves text previews when the node is outside the viewed subgraph', () => {
      showCanvasNode()
      const workflow = createWorkflow()
      useWorkflowStore().activeWorkflow = workflow
      storeActiveJob(workflow)
      vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue(
        undefined
      )
      mountPreviews()

      useExecutionStore().clearActiveJobIfStale(new Set())

      expect(removeTextPreview).not.toHaveBeenCalled()
    })
  })

  it('unsubscribes from both sources when its scope is disposed', () => {
    showCanvasNode()
    const workflow = createWorkflow()
    useWorkflowStore().activeWorkflow = workflow
    storeActiveJob(workflow)

    mountPreviews().stop()
    useExecutionStore().clearActiveJobIfStale(new Set())

    expect(api.removeEventListener).toHaveBeenCalledWith(
      'progress_text',
      progressTextListener(),
      undefined
    )
    expect(removeTextPreview).not.toHaveBeenCalled()
  })
})
