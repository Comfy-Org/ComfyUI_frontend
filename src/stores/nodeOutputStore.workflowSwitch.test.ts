import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'

const { WORKFLOW_A, WORKFLOW_B } = vi.hoisted(() => ({
  WORKFLOW_A: 'workflows/a.json',
  WORKFLOW_B: 'workflows/b.json'
}))

const mocks = vi.hoisted(() => ({
  workflowStore: null as unknown as {
    activeWorkflow: { path: string } | null
    openWorkflows: { path: string }[]
    nodeIdToNodeLocatorId: (id: string | number) => string
    nodeToNodeLocatorId: (node: { id: string | number }) => string
  }
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isAnimatedOutput: vi.fn(() => false),
  isVideoNode: vi.fn(() => false),
  resolveNode: vi.fn()
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => ''),
    getRandParam: vi.fn(() => ''),
    rootGraph: { getNodeById: vi.fn() },
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  mocks.workflowStore = reactive({
    activeWorkflow: { path: WORKFLOW_A },
    openWorkflows: [{ path: WORKFLOW_A }, { path: WORKFLOW_B }],
    nodeIdToNodeLocatorId: (id: string | number) => String(id),
    nodeToNodeLocatorId: (node: { id: string | number }) => String(node.id)
  })
  return { useWorkflowStore: () => mocks.workflowStore }
})

const createMockNode = (id: number): LGraphNode =>
  fromAny<LGraphNode, unknown>({ id: toNodeId(id), type: 'KSampler' })

/**
 * Mirrors `workflowService.beforeLoadNewGraph()` -> `app.clean()` ->
 * `workflowService.afterLoadNewGraph()`, the sequence every workflow load and
 * tab switch runs.
 */
function switchToWorkflow(path: string) {
  const store = useNodeOutputStore()
  const leaving = mocks.workflowStore.activeWorkflow
  if (leaving) store.stashPreviewsForWorkflow(leaving.path)
  store.resetAllOutputsAndPreviews()
  mocks.workflowStore.activeWorkflow = { path }
  store.restorePreviewsForWorkflow(path)
}

// Object URL retain counts live in a module-level map in objectUrlUtil, so
// every test needs its own URLs or the counts leak between them.
let urlCounter = 0

describe('nodeOutputStore preview lifecycle across workflow tab switches', () => {
  let revokeObjectURL: ReturnType<typeof vi.spyOn>

  const createBlobUrl = () => URL.createObjectURL(new Blob(['x']))

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:mock/${++urlCounter}`
    )
    revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
    mocks.workflowStore.activeWorkflow = { path: WORKFLOW_A }
    mocks.workflowStore.openWorkflows = [
      { path: WORKFLOW_A },
      { path: WORKFLOW_B }
    ]
  })

  it('keeps a finished run preview when the user switches tabs and comes back', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)
    const previewUrl = createBlobUrl()

    // A run finished on workflow A and left its last preview frame on node 5.
    // Nothing revokes it at execution end, so the node keeps displaying it.
    store.setNodePreviewsByNodeId(node.id, [previewUrl])
    expect(store.getNodePreviews(node)).toEqual([previewUrl])

    // User switches to workflow B, then back to workflow A.
    switchToWorkflow(WORKFLOW_B)
    switchToWorkflow(WORKFLOW_A)

    expect(store.getNodePreviews(node)).toEqual([previewUrl])
    expect(store.nodePreviewImages['5']).toEqual([previewUrl])
    // The blob must still be alive; a b_preview frame cannot be re-fetched.
    expect(revokeObjectURL).not.toHaveBeenCalledWith(previewUrl)
  })

  it('does not revoke the preview blob when leaving the workflow', () => {
    const store = useNodeOutputStore()
    const previewUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(createMockNode(5).id, [previewUrl])
    switchToWorkflow(WORKFLOW_B)

    // Revoking makes the loss permanent: there is no source to re-derive a
    // websocket preview frame from once the object URL is gone.
    expect(revokeObjectURL).not.toHaveBeenCalledWith(previewUrl)
  })

  it('does not show one workflow preview on another workflow same-id node', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)

    store.setNodePreviewsByNodeId(node.id, [createBlobUrl()])
    switchToWorkflow(WORKFLOW_B)

    expect(store.getNodePreviews(node)).toBeUndefined()
    expect(store.nodePreviewImages).toEqual({})
  })

  it('releases stashed previews when the workflow is closed', () => {
    const store = useNodeOutputStore()
    const previewUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(createMockNode(5).id, [previewUrl])
    switchToWorkflow(WORKFLOW_B)
    store.discardPreviewsForWorkflow(WORKFLOW_A)

    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
  })

  it('releases stashed previews of a workflow closed without a discard', () => {
    const store = useNodeOutputStore()
    const previewUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(createMockNode(5).id, [previewUrl])
    switchToWorkflow(WORKFLOW_B)

    mocks.workflowStore.openWorkflows = [{ path: WORKFLOW_B }]
    switchToWorkflow(WORKFLOW_B)

    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
  })

  it('keeps a preview that arrived while the graph was loading', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)
    const stashedUrl = createBlobUrl()
    const arrivedUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(node.id, [stashedUrl])
    switchToWorkflow(WORKFLOW_B)

    // Back to A: a frame lands between app.clean() and afterLoadNewGraph().
    store.stashPreviewsForWorkflow(WORKFLOW_B)
    store.resetAllOutputsAndPreviews()
    mocks.workflowStore.activeWorkflow = { path: WORKFLOW_A }
    store.setNodePreviewsByNodeId(node.id, [arrivedUrl])
    store.restorePreviewsForWorkflow(WORKFLOW_A)

    expect(store.getNodePreviews(node)).toEqual([arrivedUrl])
    expect(revokeObjectURL).toHaveBeenCalledWith(stashedUrl)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(arrivedUrl)
  })

  it('restores previews when the same workflow is reloaded in place', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)
    const previewUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(node.id, [previewUrl])
    // Undo/redo reloads the active workflow via loadGraphData(clean = false).
    store.stashPreviewsForWorkflow(WORKFLOW_A)
    store.restorePreviewsForWorkflow(WORKFLOW_A)

    expect(store.getNodePreviews(node)).toEqual([previewUrl])
    expect(revokeObjectURL).not.toHaveBeenCalledWith(previewUrl)
  })

  it('still revokes previews when the workflow is cleared in place', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)
    const previewUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(node.id, [previewUrl])
    // "Clear Workflow" calls app.clean() without loading another graph.
    store.resetAllOutputsAndPreviews()

    expect(store.getNodePreviews(node)).toBeUndefined()
    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
  })
})
