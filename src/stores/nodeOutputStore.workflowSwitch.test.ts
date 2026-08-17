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
    openWorkflowPaths: string[]
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
    activeWorkflow: { path: WORKFLOW_A } as { path: string } | null,
    openWorkflowPaths: [WORKFLOW_A, WORKFLOW_B],
    nodeIdToNodeLocatorId: (id: string | number) => String(id),
    nodeToNodeLocatorId: (node: { id: string | number }) => String(node.id)
  })
  return { useWorkflowStore: () => mocks.workflowStore }
})

const createMockNode = (id: number): LGraphNode =>
  fromAny<LGraphNode, unknown>({ id: toNodeId(id), type: 'KSampler' })

/**
 * Mirrors `app.clean()`, which is what `loadGraphData` runs before it
 * configures the incoming workflow's graph.
 */
function appClean() {
  useNodeOutputStore().resetAllOutputsAndPreviews()
}

/** Mirrors `workflowService.afterLoadNewGraph` moving the active pointer. */
function activateWorkflow(path: string | null) {
  mocks.workflowStore.activeWorkflow = path ? { path } : null
}

/** Mirrors `loadGraphData` + `afterLoadNewGraph` for a tab switch. */
function switchToWorkflow(path: string) {
  appClean()
  activateWorkflow(path)
}

describe('nodeOutputStore preview lifecycle across workflow tab switches', () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let urlCounter: number

  const createBlobUrl = () => URL.createObjectURL(new Blob(['x']))

  beforeEach(() => {
    urlCounter = 0
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mock/${++urlCounter}`),
      revokeObjectURL
    })
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
    mocks.workflowStore.activeWorkflow = { path: WORKFLOW_A }
    mocks.workflowStore.openWorkflowPaths = [WORKFLOW_A, WORKFLOW_B]
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
})
