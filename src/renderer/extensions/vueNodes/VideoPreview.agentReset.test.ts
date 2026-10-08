import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { getActivePinia } from 'pinia'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import * as Y from 'yjs'

import { render, screen, within } from '@testing-library/vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { AgentCrdtProjection } from '@/workbench/extensions/agent/crdt/agentCrdtProjection'
import { FollowerDoc } from '@/workbench/extensions/agent/crdt/followerDoc'

import NodeContent from './components/NodeContent.vue'

/**
 * PM-1790: a video playing in a node's media preview restarted every time the
 * agent took a turn.
 *
 * It was never a media bug. `GraphCanvas` renders one node component per
 * `nodeDataStore` record, keyed by node id, and the `VideoPreview` inside it
 * keeps playback state nowhere but its `<video>` element. Anything that drops
 * the record unmounts that subtree and takes the element with it, so the
 * canvas flicker (PM-1784) and the playback restart were one event.
 *
 * `replaceOnNextFrame` fixed both by clearing nothing until the replacement
 * frame arrives, but nothing pinned the media half, so a change there could
 * restore the symptom with every other test still green.
 *
 * What is pinned here is element survival, not playback itself: happy-dom
 * models no media pipeline, so `currentTime` never advances and asserting on
 * it would only restate identity. Survival is the guarantee that matters,
 * because the browser keeps playback going precisely when the element is
 * never unmounted.
 *
 * The guarantee is also narrower than it looks, and these tests pin its
 * boundary rather than a happy path. Because the key is the node id, the
 * element survives for as long as that id stays in the store across renders
 * -- including when `LiveGraphApplier` recreates the underlying `LGraphNode`
 * -- and is lost the moment the id lapses for even one render, which is what
 * the pre-fix eager clear did and what the last test reproduces.
 *
 * Scope. The real `NodeContent`/`VideoPreview` are mounted, so disabling
 * that branch fails every test here. Two things above them are stood in for.
 * `GraphCanvas.vue`'s node list is reproduced rather than mounted, so its
 * `:key="nodeData.id"` -- the single production line this whole guarantee
 * rests on -- is copied here; re-keying it would restore the symptom without
 * failing anything below, and nothing else in the repo asserts identity
 * across a reset either. `LGraphNode.vue` is stood in for too: in production
 * it derives the `media` prop from `nodeOutputStore` (`nodeMedia`) behind its
 * own `v-if` gates. Two consequences worth knowing before trusting these
 * tests:
 *   - `media` is a constant here, so a retype that made production's
 *     `nodeMedia` return `undefined`, or flip to `'image'`, would swap the
 *     component out and destroy the element without failing anything below.
 *   - production appends a fresh `rand` per url on non-cloud builds
 *     (`app.getRandParam`), so a surviving element can still be handed a new
 *     `src` and reload. The urls are held fixed here and `src` is asserted
 *     unchanged, which keeps identity honest but says nothing about that
 *     derivation.
 */
class MediaNode extends LGraphNode {
  static override title = 'Media Node'
}

/** Same shape, different type, to reach `upsertNode`'s recreate path. */
class OtherMediaNode extends LGraphNode {
  static override title = 'Other Media Node'
}

const WORKFLOW_ID = 'wf-media'
const CATALOG: WidgetCatalog = {
  types: {
    MediaNode: { widget_order: [] },
    OtherMediaNode: { widget_order: [] }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

function buildLiveGraph() {
  const graph = new LGraph()
  const node = LiteGraph.createNode('MediaNode')
  if (!(node instanceof MediaNode)) throw new Error('MediaNode not registered')
  graph.add(node)
  return { graph, node }
}

/** One url per node, held fixed so `src` churn would show as a failure. */
function videoUrlFor(nodeId: string | number): string {
  return `/api/view?filename=clip-${nodeId}.mp4&type=output`
}

/**
 * `GraphCanvas`'s store-backed, id-keyed node list, rendering the production
 * `NodeContent` so the real `VideoPreview` owns the `<video>` under test.
 */
function renderCanvasHost(graph: LGraph) {
  const scope = graphScopeOf(graph)
  const nodeDataStore = useNodeDataStore()
  const host = defineComponent({
    setup() {
      const allNodes = computed(() =>
        nodeDataStore.getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      )
      return () =>
        h(
          'div',
          allNodes.value.map((nodeData) =>
            h(
              'div',
              { key: nodeData.id, 'data-testid': `node-${nodeData.id}` },
              [
                h(NodeContent, {
                  nodeData,
                  media: { type: 'video', urls: [videoUrlFor(nodeData.id)] }
                })
              ]
            )
          )
        )
    }
  })
  const { unmount } = render(host, {
    global: { plugins: [getActivePinia()!, i18n] }
  })
  onTestFinished(unmount)
  /**
   * The node's own `<video>`. Reached semantically as far as the element
   * allows: `<video>` exposes no implicit ARIA role and no accessible name,
   * so the last hop has to be a direct read, as the sibling `VideoPreview`
   * suite also does. Scoped through the node's own region rather than the
   * whole tree, so it still fails if the element moves out of that subtree.
   */
  const videoFor = (nodeId: string | number): HTMLVideoElement | null => {
    const node = screen.queryByTestId(`node-${nodeId}`)
    if (!node) return null
    const region = within(node).queryByRole('region')
    // oxlint-disable-next-line testing-library/no-node-access -- <video> has no implicit ARIA role or accessible name; scoped through the node's region so it still fails if the element moves
    return region?.querySelector('video') ?? null
  }
  return {
    videoFor,
    recordIds: () =>
      nodeDataStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map(({ id }) => String(id))
  }
}

function bindProjection(graph: LGraph, saved: ISerialisedGraph) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(WORKFLOW_ID, follower)
  let seq = 0
  const deliverTo = (target: FollowerDoc, doc: Y.Doc) => {
    const update = Y.encodeStateAsUpdate(doc)
    target.applyRemoteUpdate(update)
    return projection.applyFrame({
      workflowId: WORKFLOW_ID,
      seq: ++seq,
      update,
      actor: 'agent:comfy:host',
      opIds: []
    })
  }
  expect(deliverTo(follower, host)).toMatchObject({ applied: true })
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  })

  /**
   * A whole lineage break. The `nextTick` is load-bearing: the replacement
   * frame is a network round trip behind the reset, so the canvas renders in
   * between, and that gap is the entire defect. Without it these tests cannot
   * tell an atomic swap from a clear that is merely refilled before Vue next
   * flushes -- against a reinstated eager clear two of them fail with the gap
   * and only one without it.
   */
  const replaceLineage = async (replacement: ISerialisedGraph) => {
    projection.replaceOnNextFrame(WORKFLOW_ID)
    await nextTick()
    const successor = new FollowerDoc()
    const lineage = mint(toWorkflowJson(replacement), CATALOG)
    onTestFinished(() => {
      successor.destroy()
      lineage.destroy()
    })
    projection.bind(WORKFLOW_ID, successor)
    return deliverTo(successor, lineage)
  }
  return { replaceLineage }
}

beforeEach(() => {
  LiteGraph.registerNodeType('MediaNode', MediaNode)
  LiteGraph.registerNodeType('OtherMediaNode', OtherMediaNode)
})

describe('a node video element survives an agent lineage reset', () => {
  it('keeps the node, its record and its video element across the replacement', async () => {
    const { graph, node } = buildLiveGraph()
    const saved = structuredClone(graph.serialize())
    const { replaceLineage } = bindProjection(graph, saved)
    const canvas = renderCanvasHost(graph)

    const playing = canvas.videoFor(node.id)
    assert.exists(playing, 'the node renders a video element')

    expect(await replaceLineage(saved)).toMatchObject({ applied: true })
    await nextTick()

    expect(graph.getNodeById(node.id)).toBe(node)
    expect(canvas.recordIds()).toEqual([String(node.id)])
    expect(canvas.videoFor(node.id)).toBe(playing)
    expect(playing.getAttribute('src')).toBe(videoUrlFor(node.id))
  })

  it('keeps the video element even when the replacement recreates the node', async () => {
    const { graph, node } = buildLiveGraph()
    const saved = structuredClone(graph.serialize())
    const { replaceLineage } = bindProjection(graph, saved)
    const canvas = renderCanvasHost(graph)

    const playing = canvas.videoFor(node.id)
    assert.exists(playing, 'the node renders a video element')

    // A retyped node takes `upsertNode`'s recreate path, so the `LGraphNode`
    // and its `NodeState` are both replaced -- and the element still survives,
    // because remove and re-add happen inside one applied frame, so the id
    // never leaves the rendered list across a render. This marks where the
    // guarantee lives: in id continuity, not in instance identity.
    expect(
      await replaceLineage({
        ...saved,
        nodes: saved.nodes.map((serialised) => ({
          ...serialised,
          type: 'OtherMediaNode'
        }))
      })
    ).toMatchObject({ applied: true })
    await nextTick()

    expect(graph.getNodeById(node.id)).not.toBe(node)
    expect(canvas.videoFor(node.id)).toBe(playing)
    expect(playing.getAttribute('src')).toBe(videoUrlFor(node.id))
  })

  it('loses the video element when the id leaves the store for a render', async () => {
    const { graph, node } = buildLiveGraph()
    const saved = structuredClone(graph.serialize())
    bindProjection(graph, saved)
    const canvas = renderCanvasHost(graph)

    const playing = canvas.videoFor(node.id)
    assert.exists(playing, 'the node renders a video element')

    // The control the assertions above need. The pre-fix reset emptied the
    // records and refilled them only once a replacement frame arrived, so the
    // id was absent across at least one render. Driven through the graph API,
    // since the method that used to do it is gone.
    graph.remove(node)
    await nextTick()
    expect(canvas.videoFor(node.id)).toBeNull()

    const readded = LiteGraph.createNode('MediaNode')!
    readded.id = node.id
    graph.add(readded)
    await nextTick()

    expect(canvas.videoFor(node.id)).not.toBeNull()
    expect(canvas.videoFor(node.id)).not.toBe(playing)
  })
})
