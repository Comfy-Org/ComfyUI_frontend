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

type WorkflowNode = ComfyWorkflowJSON['nodes'][number]

function node(id: number, type: string): WorkflowNode {
  return {
    id,
    type,
    pos: [0, 0],
    size: [100, 50],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: {}
  }
}

// Stable ids across every history state, so undo removes the partner nodes
// from one workflow rather than swapping in a differently identified graph.
const checkpointLoader = node(1, CHECKPOINT_LOADER)
const openAiPartnerNode = node(2, OPENAI_PARTNER_NODE)
const lumaPartnerNode = node(3, LUMA_PARTNER_NODE)

function workflowOf(nodes: WorkflowNode[]): ComfyWorkflowJSON {
  return {
    nodes: structuredClone(nodes),
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: 3,
    last_link_id: 0
  }
}

function nodeTypesOf(state: ComfyWorkflowJSON): string[] {
  return state.nodes.map((graphNode) => graphNode.type)
}

function putOnCanvas(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(
    structuredClone(state) as never
  )
}

/**
 * Model of one `app.loadGraphData` call, matching the order production runs
 * it in: raise `ChangeTracker.isLoadingGraph` (`app.ts`), reach
 * `rootGraph.configure` so the canvas already holds the restored graph, then
 * keep awaiting (`afterConfigureGraph` hooks, asset scans, navigation hash)
 * and lower the flag in the per-call `finally` just before settling. Both
 * guards `captureCanvasState` consults are therefore driven the way the real
 * load drives them, including their per-call `finally` clears.
 *
 * Not modelled: the pre-`configure` awaits, and the `deactivate()`/`reset()`
 * calls `beforeLoadNewGraph`/`afterLoadNewGraph` make on the tracker. Neither
 * runs on the undo path these tests exercise, which passes `clean: false`.
 */
function beginLoad(state: ComfyWorkflowJSON) {
  ChangeTracker.isLoadingGraph = true
  putOnCanvas(state)
  return () => {
    ChangeTracker.isLoadingGraph = false
  }
}

/** Loads whose promise settles only once the test releases it. */
function holdLoadsUntilReleased() {
  const releases: (() => void)[] = []
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    const finishLoad = beginLoad(graphData as ComfyWorkflowJSON)
    return new Promise((resolve) =>
      releases.push(() => {
        finishLoad()
        resolve(true)
      })
    )
  })
  return releases
}

function settleLoadsImmediately() {
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    beginLoad(graphData as ComfyWorkflowJSON)()
    return Promise.resolve(true)
  })
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
 * The reporter did not capture a repro, so the sequence below is a hypothesis
 * consistent with the symptoms rather than a confirmed account of their
 * session. `ChangeTracker.updateState` awaits `app.loadGraphData` while
 * guarding itself with the boolean `_restoringState`, and `loadGraphData`
 * guards itself with the boolean `ChangeTracker.isLoadingGraph`. A second
 * Ctrl+Z arriving before the first load settles re-enters both: each keypress
 * schedules its own detached `requestAnimationFrame` callback in
 * `ChangeTracker.init`, nothing serialises them, and the first restore's
 * `finally` clears each shared flag while the second restore is still in
 * flight. A `captureCanvasState` landing in that window compares a canvas the
 * second restore has already moved against the state the first one recorded,
 * treats the difference as an edit, and empties the redo queue.
 *
 * Autosave is one way into that window and the one the report names, via
 * `workflowService.saveWorkflow` -> `prepareForSave`. It is not the cheapest:
 * the `mouseup` listener in `ChangeTracker.init` calls `captureCanvasState`
 * with no delay, so a single click between the two restores does the same
 * damage.
 *
 * Partner nodes carry no special graph representation — they are ordinary
 * nodes whose *definition* sets `api_node: true`, see `usePartnerNodesInGraph`
 * — so what makes them vanish is damage to the undo history itself. The
 * workflows below stand in for the reported one: a checkpoint loader plus the
 * two partner nodes the user watched disappear.
 *
 * Pre-flight: `updateState` is byte-identical between `v1.53.7` (the release
 * line on Comfy Cloud prod) and `main`, so this is not fixed in 1.53 and is
 * not a regression introduced after it.
 *
 * The two `it.fails` cases pin different halves and can flip independently:
 * the first covers the emptied redo queue the report describes, the second
 * covers the duplicate redo entry that loses the intermediate workflow.
 */
describe('ChangeTracker undo/redo under a re-entrant undo (ING-198)', () => {
  const beforePartnerNodes = () => workflowOf([checkpointLoader])
  const withOnePartnerNode = () =>
    workflowOf([checkpointLoader, openAiPartnerNode])
  const withBothPartnerNodes = () =>
    workflowOf([checkpointLoader, openAiPartnerNode, lumaPartnerNode])

  beforeEach(() => {
    ChangeTracker.isLoadingGraph = false
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

  // Drives the same arrange as the two expected-failure cases below, unmarked,
  // so a broken fixture reddens here instead of being absorbed by `it.fails`.
  // Both assertions hold whether or not the re-entrancy is fixed.
  it('lands on the workflow from before the partner nodes when a second undo starts mid-restore', async () => {
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

    expect(app.loadGraphData).toHaveBeenCalledTimes(2)
    expect(nodeTypesOf(tracker.activeState)).toEqual([CHECKPOINT_LOADER])
  })

  it.fails('KNOWN BUG (ING-198): redo restores the partner nodes that a re-entrant undo removed while autosave is on', async () => {
    const releaseLoad = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()

    // Awaiting the first restore is the readiness boundary: it has cleared
    // both shared flags in its `finally` while the second is still loading.
    // `prepareForSave` is the entry point every autosave takes through
    // `workflowService.saveWorkflow`.
    releaseLoad[0]()
    await firstUndo
    tracker.prepareForSave()

    releaseLoad[1]()
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
