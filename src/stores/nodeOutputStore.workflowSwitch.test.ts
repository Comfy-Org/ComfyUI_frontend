import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

const { WORKFLOW_A, WORKFLOW_B } = vi.hoisted(() => ({
  WORKFLOW_A: 'workflows/a.json',
  WORKFLOW_B: 'workflows/b.json'
}))

vi.mock<unknown>(import('@/utils/litegraphUtil'), () => ({
  isAnimatedOutput: vi.fn(() => false),
  isVideoNode: vi.fn(() => false),
  resolveNode: vi.fn()
}))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

vi.mock(import('@/scripts/app'))

const KEPT_SUBGRAPH = '11111111-1111-4111-8111-111111111111'
const OTHER_SUBGRAPH = '22222222-2222-4222-8222-222222222222'

const createMockNode = (id: number): LGraphNode =>
  fromAny<LGraphNode, unknown>({ id: toNodeId(id), type: 'KSampler' })

/**
 * Mirrors `workflowService.beforeLoadNewGraph()` -> `app.clean()` ->
 * `workflowService.afterLoadNewGraph()`, the sequence every workflow load and
 * tab switch runs.
 */
function switchToWorkflow(path: string) {
  const store = useNodeOutputStore()
  const leaving = useWorkflowStore().activeWorkflow
  if (leaving) store.stashPreviewsForWorkflow(leaving.path)
  store.resetAllOutputsAndPreviews()
  useWorkflowStore().activeWorkflow = fromPartial({ path })
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
    useWorkflowStore().activeWorkflow = fromPartial({ path: WORKFLOW_A })
    Object.assign(useWorkflowStore(), {
      openWorkflows: [{ path: WORKFLOW_A }, { path: WORKFLOW_B }]
    })
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

    Object.assign(useWorkflowStore(), { openWorkflows: [{ path: WORKFLOW_B }] })
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
    useWorkflowStore().activeWorkflow = fromPartial({ path: WORKFLOW_A })
    store.setNodePreviewsByNodeId(node.id, [arrivedUrl])
    store.restorePreviewsForWorkflow(WORKFLOW_A)

    expect(store.getNodePreviews(node)).toEqual([arrivedUrl])
    expect(revokeObjectURL).toHaveBeenCalledWith(stashedUrl)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(arrivedUrl)
  })

  it('adds a frame that arrived while the workflow was off the canvas to its stash', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(5)
    const otherNode = createMockNode(6)
    const stashedUrl = createBlobUrl()
    const otherUrl = createBlobUrl()
    const arrivedUrl = createBlobUrl()

    store.setNodePreviewsByNodeId(node.id, [stashedUrl])
    store.setNodePreviewsByNodeId(otherNode.id, [otherUrl])
    store.stashPreviewsForWorkflow(WORKFLOW_A)
    store.resetAllOutputsAndPreviews()
    store.setNodePreviewsByNodeId(node.id, [arrivedUrl])
    store.addLivePreviewsToStash(WORKFLOW_A)
    store.resetAllOutputsAndPreviews()
    store.restorePreviewsForWorkflow(WORKFLOW_A)

    expect(store.getNodePreviews(node)).toEqual([arrivedUrl])
    expect(store.getNodePreviews(otherNode)).toEqual([otherUrl])
    expect(revokeObjectURL).toHaveBeenCalledWith(stashedUrl)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(arrivedUrl)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(otherUrl)
  })

  describe('restoring into a graph without the preview subgraph', () => {
    // A frame for a subgraph node can be resolved against another workflow's
    // graph while that graph is briefly on the canvas, so it lands under a
    // subgraph id the restored workflow does not have.
    beforeEach(() => {
      vi.spyOn(app, 'rootGraphOrUndefined', 'get').mockReturnValue(
        fromPartial<LGraph>({
          subgraphs: new Map([[KEPT_SUBGRAPH, fromPartial<Subgraph>({})]])
        })
      )
    })

    it('drops and revokes the preview while restoring root and in-graph subgraph previews', () => {
      const store = useNodeOutputStore()
      const rootUrl = createBlobUrl()
      const keptUrl = createBlobUrl()
      const otherUrl = createBlobUrl()
      const keptLocator = createNodeLocatorId(KEPT_SUBGRAPH, 6)
      const otherLocator = createNodeLocatorId(OTHER_SUBGRAPH, 6)

      store.setNodePreviewsByNodeId(createMockNode(5).id, [rootUrl])
      store.setNodePreviewsByLocatorId(keptLocator, [keptUrl])
      store.setNodePreviewsByLocatorId(otherLocator, [otherUrl])
      switchToWorkflow(WORKFLOW_B)
      switchToWorkflow(WORKFLOW_A)

      expect(store.nodePreviewImages).toEqual({
        '5': [rootUrl],
        [keptLocator]: [keptUrl]
      })
      expect(app.nodePreviewImages).toEqual(store.nodePreviewImages)
      expect(revokeObjectURL).toHaveBeenCalledWith(otherUrl)
      expect(revokeObjectURL).not.toHaveBeenCalledWith(rootUrl)
      expect(revokeObjectURL).not.toHaveBeenCalledWith(keptUrl)
    })

    it('does not revoke a dropped preview URL that a restored preview still shows', () => {
      const store = useNodeOutputStore()
      const sharedUrl = createBlobUrl()
      const keptLocator = createNodeLocatorId(KEPT_SUBGRAPH, 6)
      const otherLocator = createNodeLocatorId(OTHER_SUBGRAPH, 6)

      // One frame fans out to the subgraph node and its container on the root.
      store.setNodePreviewsByNodeId(createMockNode(5).id, [sharedUrl])
      store.setNodePreviewsByLocatorId(otherLocator, [sharedUrl])
      store.setNodePreviewsByLocatorId(keptLocator, [sharedUrl])
      switchToWorkflow(WORKFLOW_B)
      switchToWorkflow(WORKFLOW_A)

      expect(store.nodePreviewImages).toEqual({
        '5': [sharedUrl],
        [keptLocator]: [sharedUrl]
      })
      expect(revokeObjectURL).not.toHaveBeenCalledWith(sharedUrl)

      store.revokePreviewsByLocatorId(keptLocator)
      store.revokePreviewsByLocatorId(createNodeLocatorId(null, 5))

      expect(revokeObjectURL).toHaveBeenCalledWith(sharedUrl)
    })
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
