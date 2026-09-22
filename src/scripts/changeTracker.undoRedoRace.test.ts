import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, ref } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    graph: {},
    rootGraph: { subgraphs: new Map(), serialize: vi.fn() },
    loadGraphData: vi.fn(),
    canvas: { ds: { scale: 1, offset: [0, 0] }, setGraph: vi.fn() },
    ui: { autoQueueEnabled: false, autoQueueMode: 'instant' }
  })
}))

vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
}))

import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'

const CHECKPOINT_LOADER = 'CheckpointLoaderSimple'
const OPENAI_PARTNER_NODE = 'OpenAIGPTImage1'
const LUMA_PARTNER_NODE = 'LumaImageNode'

let nextNodeId = 0

function workflowOf(nodeTypes: string[]): ComfyWorkflowJSON {
  return {
    nodes: nodeTypes.map((type) => ({
      id: ++nextNodeId,
      type,
      pos: [0, 0],
      size: [100, 50],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    })),
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: nextNodeId,
    last_link_id: 0
  }
}

function nodeTypesOf(state: ComfyWorkflowJSON): string[] {
  return state.nodes.map((node) => node.type)
}

function putOnCanvas(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(
    structuredClone(state) as never
  )
}

/**
 * `loadGraphData` reconfigures the canvas partway through, then keeps awaiting
 * (`afterConfigureGraph` hooks, asset scans, navigation hash) before its
 * promise settles. This double reproduces that split: the canvas is updated
 * when the load is issued, and the returned promise settles only once the test
 * releases it, so a test can act inside the window where the canvas has
 * already moved but the restore has not finished.
 */
function holdLoadsUntilReleased() {
  const releases: (() => void)[] = []
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    putOnCanvas(graphData as ComfyWorkflowJSON)
    return new Promise((resolve) => releases.push(() => resolve(true)))
  })
  return releases
}

function settleLoadsImmediately() {
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    putOnCanvas(graphData as ComfyWorkflowJSON)
    return Promise.resolve(true)
  })
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve())
}

function trackerEditing(
  current: ComfyWorkflowJSON,
  undoHistory: ComfyWorkflowJSON[]
) {
  const tracker = markRaw(
    new ChangeTracker(
      fromPartial({ path: '/cloud/member-workspace.json' }),
      structuredClone(current)
    )
  )
  useWorkflowStore().activeWorkflow = fromPartial({ changeTracker: tracker })
  tracker.undoQueue.push(...undoHistory.map((state) => structuredClone(state)))
  putOnCanvas(current)
  return tracker
}

/**
 * ING-198: on Comfy Cloud a member-workspace undo removed partner nodes, and
 * redo could not bring them back, with `Comfy.Workflow.AutoSave` enabled.
 *
 * `ChangeTracker.updateState` awaits `app.loadGraphData` while guarding itself
 * with the boolean `_restoringState`. Ctrl+Z pressed twice before the first
 * load settles re-enters it, because each keypress schedules its own detached
 * `requestAnimationFrame` callback in `ChangeTracker.init` and nothing
 * serialises them. The first restore's `finally` then clears the shared flag
 * while the second restore is still in flight.
 *
 * Partner nodes carry no special graph representation — they are ordinary
 * nodes whose *definition* sets `api_node: true`, see `usePartnerNodesInGraph`
 * — so what makes them vanish is damage to the undo history itself. The
 * workflows below stand in for the reported one: a checkpoint loader plus the
 * two partner nodes the user watched disappear.
 */
describe('ChangeTracker undo/redo under a re-entrant undo (ING-198)', () => {
  const beforePartnerNodes = () => workflowOf([CHECKPOINT_LOADER])
  const withOnePartnerNode = () =>
    workflowOf([CHECKPOINT_LOADER, OPENAI_PARTNER_NODE])
  const withBothPartnerNodes = () =>
    workflowOf([CHECKPOINT_LOADER, OPENAI_PARTNER_NODE, LUMA_PARTNER_NODE])

  beforeEach(() => {
    nextNodeId = 0
  })

  it('restores both partner nodes when each undo settles before the next begins', async () => {
    settleLoadsImmediately()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    await tracker.undo()
    tracker.prepareForSave()
    await tracker.undo()
    tracker.prepareForSave()

    expect(nodeTypesOf(tracker.activeState)).toEqual([CHECKPOINT_LOADER])

    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE
    ])

    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE,
      LUMA_PARTNER_NODE
    ])
  })

  it.fails('KNOWN BUG (ING-198): redo restores the partner nodes that a re-entrant undo removed while autosave is on', async () => {
    const releaseLoad = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()

    // The first restore settles while the second is still loading, and its
    // `finally` clears the shared `_restoringState` flag. The autosave that
    // `updateModified`'s `graphChanged` event scheduled now reaches
    // `captureCanvasState` mid-restore. `prepareForSave` is the entry point
    // every autosave takes through `workflowService.saveWorkflow`.
    releaseLoad[0]()
    await flushMicrotasks()
    tracker.prepareForSave()

    releaseLoad[1]()
    await firstUndo
    await secondUndo

    settleLoadsImmediately()
    await tracker.redo()
    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE,
      LUMA_PARTNER_NODE
    ])
  })

  it.fails('KNOWN BUG (ING-198): one redo after a re-entrant undo steps back to the intermediate workflow', async () => {
    const releaseLoad = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()
    releaseLoad[0]()
    releaseLoad[1]()
    await firstUndo
    await secondUndo

    settleLoadsImmediately()
    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE
    ])
  })
})
