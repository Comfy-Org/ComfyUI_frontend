import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, ref } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApi } from '@/scripts/api'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
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

/**
 * The assertion bridges the known zod/litegraph divergence, at the seam
 * `captureCanvasState` already casts across. Authoring the fixture as
 * `ISerialisedGraph` needs a second hand-synced copy of every workflow, the
 * history queues being `ComfyWorkflowJSON`; their drifting apart is the bug.
 */
function putOnCanvas(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(
    structuredClone(state) as ISerialisedGraph
  )
}

/**
 * Model of one `app.loadGraphData` call, in the order production runs it:
 * raise `ChangeTracker.isLoadingGraph`, reach `rootGraph.configure` so the
 * canvas already holds the restored graph, then keep awaiting
 * (`afterConfigureGraph` hooks, asset scans, navigation hash) and lower the
 * flag in the per-call `finally` just before settling. Both guards
 * `captureCanvasState` consults are therefore driven the way the real load
 * drives them, including their per-call `finally` clears.
 *
 * Not modelled: the awaits before `configure`, and the
 * `deactivate()`/`reset()`/`restore()` calls that `beforeLoadNewGraph` and
 * `afterLoadNewGraph` make on this very tracker. Those do run on the undo
 * path, and they are inert only because `_restoringState` is true when they
 * are reached — the same flag whose premature clearing these tests are about.
 * In the re-entrant window `reset()` can therefore find it already cleared and
 * overwrite `activeState`/`initialState`: a second corruption channel this
 * double deliberately leaves out, so the cases below isolate the redo queue.
 *
 * This goes stale if `app.ts` stops assigning the flag directly. A refcount
 * kept inside `loadGraphData` would fix the symptom without any case here
 * noticing; refcounting the declaration in `changeTracker.ts` is caught.
 */
function beginLoad(state: ComfyWorkflowJSON) {
  ChangeTracker.isLoadingGraph = true
  putOnCanvas(state)
  return () => {
    ChangeTracker.isLoadingGraph = false
  }
}

function settleLoadsImmediately() {
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    beginLoad(graphData as ComfyWorkflowJSON)()
    return Promise.resolve(true)
  })
}

/** `loadGraphData`'s own failure result: the canvas keeps the graph it had. */
function refuseFirstLoad() {
  let loadsSeen = 0
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    loadsSeen++
    if (loadsSeen > 1) {
      beginLoad(graphData as ComfyWorkflowJSON)()
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  })
}

/** Only the post-`configure` stages throw, so the canvas did move. */
function throwAfterFirstLoadConfigures(error: Error) {
  let loadsSeen = 0
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    loadsSeen++
    const finishLoad = beginLoad(graphData as ComfyWorkflowJSON)
    finishLoad()
    return loadsSeen > 1 ? Promise.resolve(true) : Promise.reject(error)
  })
}

/**
 * Loads whose promise settles only when the test releases it. Releasing is
 * count-independent on purpose: how many loads are outstanding depends on
 * whether restores overlap, so indexing them would make the harness throw
 * rather than let the assertions speak.
 */
function holdLoadsUntilReleased() {
  const outstanding: (() => void)[] = []
  vi.mocked(app.loadGraphData).mockImplementation((graphData) => {
    const finishLoad = beginLoad(graphData as ComfyWorkflowJSON)
    return new Promise((resolve) =>
      outstanding.push(() => {
        finishLoad()
        resolve(true)
      })
    )
  })
  return {
    get heldCount() {
      return outstanding.length
    },
    /** Waits, so a deferred restore is still released rather than deadlocked. */
    releaseOldest: async () => {
      await vi.waitUntil(() => outstanding.length > 0, {
        timeout: 500,
        interval: 1
      })
      outstanding.shift()?.()
    },
    /** Release everything outstanding, and let any later load settle at once. */
    settleRest: () => {
      const release = outstanding.splice(0)
      settleLoadsImmediately()
      release.forEach((releaseLoad) => releaseLoad())
    }
  }
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
 * treats the difference as an edit, and empties the redo queue. `Comfy.Undo`
 * in the Edit menu reaches `updateState` the same way, so the corruption is
 * not specific to the keyboard.
 *
 * Autosave is one way into that window and the one the report names, via
 * `workflowService.saveWorkflow` -> `prepareForSave`. It is not the cheapest:
 * the `mouseup` listener in `ChangeTracker.init` calls `captureCanvasState`
 * with no delay, so a single click between the two restores does the same
 * damage.
 *
 * Only the second half of the report is reproduced here — redo failing to
 * restore. Undo removing the partner nodes in the first place is ordinary
 * semantics against this history, and what made it feel unexpected to the
 * reporter is not recoverable from the report.
 *
 * Partner nodes carry no special graph representation — they are ordinary
 * nodes whose *definition* sets `api_node: true`, see `usePartnerNodesInGraph`
 * — so what makes them vanish is damage to the undo history itself. The
 * workflows below stand in for the reported one: a checkpoint loader plus the
 * two partner nodes the user watched disappear.
 *
 * Pre-flight: `updateState`, `_restoringState`, `captureCanvasState`'s guards
 * and `loadGraphData`'s `isLoadingGraph` lifecycle were all unchanged between
 * `v1.53.7` (the release line on Comfy Cloud prod) and `main`, so this was
 * broken in 1.53 too, not a regression introduced after it.
 *
 * The last two cases pin defects that can regress independently: the emptied
 * redo queue the report describes, and the duplicate redo entry that loses the
 * intermediate workflow.
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

  it('starts no second restore until the first has settled', async () => {
    const loads = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()
    await vi.waitUntil(() => loads.heldCount > 0)

    expect(loads.heldCount).toBe(1)

    loads.settleRest()
    await firstUndo
    await secondUndo

    expect(nodeTypesOf(tracker.activeState)).toEqual([CHECKPOINT_LOADER])
  })

  it('redo restores the partner nodes when an autosave lands between two rapid undos', async () => {
    const loads = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()

    // `prepareForSave` is the entry point every autosave takes through
    // `workflowService.saveWorkflow`. It lands here, between the two
    // restores, which is where it used to empty the redo queue.
    await loads.releaseOldest()
    await firstUndo
    tracker.prepareForSave()

    loads.settleRest()
    await secondUndo

    await tracker.redo()
    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE,
      LUMA_PARTNER_NODE
    ])
  })

  it('leaves the history untouched when the load refuses, so the next undo still works', async () => {
    refuseFirstLoad()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    await tracker.undo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE,
      LUMA_PARTNER_NODE
    ])
    expect(tracker.redoQueue).toEqual([])

    tracker.prepareForSave()
    await tracker.undo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE
    ])
  })

  it('records the workflow the canvas reached when a load throws after configuring', async () => {
    const loadFailure = new Error('afterConfigureGraph hook failed')
    throwAfterFirstLoadConfigures(loadFailure)
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    await expect(tracker.undo()).rejects.toThrow(loadFailure)

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE
    ])

    tracker.prepareForSave()

    expect(tracker.redoQueue.map(nodeTypesOf)).toEqual([
      [CHECKPOINT_LOADER, OPENAI_PARTNER_NODE, LUMA_PARTNER_NODE]
    ])
  })

  it('records each distinct state once, so redo steps back through the intermediate workflow', async () => {
    const loads = holdLoadsUntilReleased()
    const tracker = trackerEditing(withBothPartnerNodes(), [
      beforePartnerNodes(),
      withOnePartnerNode()
    ])

    const firstUndo = tracker.undo()
    const secondUndo = tracker.undo()
    await vi.waitUntil(() => loads.heldCount > 0)
    loads.settleRest()
    await firstUndo
    await secondUndo

    expect(tracker.redoQueue.map(nodeTypesOf)).toEqual([
      [CHECKPOINT_LOADER, OPENAI_PARTNER_NODE, LUMA_PARTNER_NODE],
      [CHECKPOINT_LOADER, OPENAI_PARTNER_NODE]
    ])

    await tracker.redo()

    expect(nodeTypesOf(tracker.activeState)).toEqual([
      CHECKPOINT_LOADER,
      OPENAI_PARTNER_NODE
    ])
  })
})
