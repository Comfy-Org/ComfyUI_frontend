import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring, MintableGraph } from './mintPortWiring'

/**
 * Reproduces the switch-away race named in the entry condition: `app.ts`
 * reuses one `LGraph` instance as `rootGraph` across every workflow, and the
 * next workflow's nodes are attached to it (`LGraph.add` -> `attachNodeLayout`)
 * while `isDocBound()` still reports the PREVIOUS workflow's binding, because
 * `activeWorkflow` does not flip until after `afterConfigureGraph` fires and
 * the load's `beginGraphTeardown`/`endGraphTeardown` bracket has no `await`
 * between `configure()` and `endGraphTeardown()` on the happy path. The
 * layout store queues its `createNode` notification on a microtask
 * (`queueChange` -> `queueMicrotask`), so it is still pending when the
 * bracket closes and fires once `isDocBound()` is (still, wrongly) true.
 */
async function flushLayoutStoreMicrotask(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('attachMintPortWiring: root graph scope across a tab switch', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let liveGraph: LGraph
  let graphNodes: Map<string, LGraphNode>

  beforeEach(() => {
    minted = []
    graphNodes = new Map()
    liveGraph = new LGraph()
    liveGraph.id = createUuidv4()

    const graphAdapter: MintableGraph = {
      get id() {
        return liveGraph.id
      },
      get rootGraph() {
        return { id: liveGraph.rootGraph.id }
      },
      getNodeById: (id) => graphNodes.get(String(id)) ?? null,
      get _nodes() {
        return [...graphNodes.values()]
      }
    }

    wiring = attachMintPortWiring({
      isEnabled: () => true,
      // The bound document never becomes unbound during this race: the
      // follower flips `isBoundWorkflowActive` only once `activeWorkflow`
      // itself changes, which happens strictly after this bracket closes.
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => layoutStore.onChange(listener),
      localActorPrefix: ACTOR_CONFIG.USER_PREFIX,
      getGraph: () => graphAdapter
    })
  })

  afterEach(() => wiring.detach())

  it("does not mint add_node for a newly configured workflow's nodes while the previous workflow is still the bound document", async () => {
    // Switch-away: `beforeLoadNewGraph` -> `beforeLoadGraph` fires first.
    wiring.onBeforeGraphLoad()

    // `rootGraph.configure(B)` reuses the SAME LGraph instance but rewrites
    // its `id` from B's stored workflow JSON (`_configureBase`), then adds
    // B's nodes to it. Each `LGraph.add()` queues a layout `createNode`
    // change for the NEW graph id on a microtask.
    liveGraph.id = createUuidv4()
    const nodeFromOtherWorkflow = new LGraphNode('TestNode')
    nodeFromOtherWorkflow.id = toNodeId(101)
    liveGraph.add(nodeFromOtherWorkflow)
    graphNodes.set('101', nodeFromOtherWorkflow)

    // `afterConfigureGraph` -> `endGraphTeardown()` runs synchronously right
    // after `configure()`, with no `await` in between on the happy path.
    wiring.onAfterGraphConfigure()

    // The queued layout change flushes only now, once the synchronous
    // portion of the switch has finished, and lands while `isDocBound()`
    // still (wrongly) reports the previous workflow's document as bound.
    await flushLayoutStoreMicrotask()

    expect(minted.filter((operation) => operation.op === 'add_node')).toEqual(
      []
    )
  })
})
