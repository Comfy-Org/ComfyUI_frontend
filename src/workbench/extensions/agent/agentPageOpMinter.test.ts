/**
 * PM-2451 / FRONT-3582 stage 2: a hand edit made while the Agent panel is
 * closed must still mint.
 *
 * `DockedAgentPanel.vue` renders the panel under `v-if`, so closing it is an
 * ordinary unmount. Before this seam existed, the op producer was attached in
 * `AgentPanelRoot.setup()` and detached from `runPanelTeardown`, so an edit
 * made with the panel closed minted nothing at all — no operation, no retained
 * batch, nothing for the next acknowledged resubscribe to replay. It reached
 * production as 16 of the 74 `failure_syncing_agent_edit_undeliverable` events
 * on Sentry group CLOUD-FRONTEND-PROD-3A8, and as the silent half nobody saw.
 *
 * The unmount is modelled the way it actually happens: the panel's own
 * `useAgentCrdtFollower` lease is released, so every accessor it destructured
 * answers with a null fallback, while the session itself stays alive behind the
 * page's claim. A producer that read the panel's handle would mint nothing from
 * that moment on, which is the defect with extra machinery; these tests pin
 * that it reads the page's claim instead.
 */
import { fromPartial } from '@total-typescript/shoehorn'
import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import type { RootGraphId } from '@comfyorg/graph-model/graphScopeId'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { AgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import type { GraphOperation } from './crdt/graphOperations'
import type { AgentFollowerSession } from './crdt/useAgentCrdtFollower'
import type { AgentPanelOpMinterInputs } from './agentPageOpMinter'
import {
  destroyAgentPageOpMinters,
  retainDocOpMinterForPage
} from './agentPageOpMinter'

const pageSession = shallowRef<AgentFollowerSession | null>(null)

vi.mock(import('./crdt/useAgentCrdtFollower'), () => ({
  retainedAgentFollowerSessionRef: () => pageSession
}))

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {})
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

function afterFlush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

/** A session whose `enqueueHumanOperations` records what reached it. */
function fakeSession(sink: GraphOperation[]): AgentFollowerSession {
  return fromPartial<AgentFollowerSession>({
    status: shallowRef({ connected: true }),
    subscriptionSent: () => true,
    enqueueHumanOperations: (operations: GraphOperation[]) =>
      sink.push(...operations),
    noteUnboundLocalIntent: () => {},
    docInputNames: () => null,
    docWidgetValue: () => undefined,
    docPromotedWidgets: () => null,
    mayWritePromotedHost: () => true,
    isPreMintBinding: () => false,
    docHasSubgraphDefinition: () => false,
    notifyWidgetWriteRefused: () => {}
  })
}

describe('retainDocOpMinterForPage', () => {
  const transport = fromPartial<AgentDocFrameTransport>({})
  let graph: LGraph
  let rootGraphId: RootGraphId
  let boundWorkflow: ComfyWorkflow
  let minted: GraphOperation[]
  let unboundVisibleIntents: string[]

  function panelInputs(
    overrides: Partial<AgentPanelOpMinterInputs> = {}
  ): AgentPanelOpMinterInputs {
    return {
      isEnabled: () => true,
      isTargetActive: () => true,
      getGraph: () => graph,
      isBoundWorkflow: (workflow) => workflow === boundWorkflow,
      boundRootGraphId: () => rootGraphId,
      onUnboundVisibleIntent: (rootGraph) =>
        unboundVisibleIntents.push(rootGraph.id),
      ...overrides
    }
  }

  beforeEach(() => {
    LiteGraph.registerNodeType('TestSource', TestSource)
    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    boundWorkflow = fromPartial<ComfyWorkflow>({ path: 'workflows/bound.json' })
    minted = []
    unboundVisibleIntents = []
    pageSession.value = fakeSession(minted)
  })

  afterEach(() => {
    destroyAgentPageOpMinters()
    pageSession.value = null
  })

  it('mints an edit made after the panel released its follower lease', async () => {
    retainDocOpMinterForPage(transport, panelInputs())

    // The panel unmounts. Its consumer lease is released, so a producer that
    // read the panel's handle would now see a null session; the page's claim
    // is untouched.
    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('resolves the page-held session per call, so a rebind redirects the mint', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    const rebound: GraphOperation[] = []
    pageSession.value = fakeSession(rebound)

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(rebound.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('attaches one producer across a remount rather than a second', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    retainDocOpMinterForPage(transport, panelInputs())
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    // A second producer on the same intent bus would double every operation.
    expect(minted.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('installs the remounted panel answers rather than the stale ones', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    retainDocOpMinterForPage(transport, panelInputs({ isEnabled: () => false }))

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('holds the edit as unbound local intent when the page holds no session', async () => {
    const noted: string[] = []
    pageSession.value = fromPartial<AgentFollowerSession>({
      status: shallowRef({ connected: false }),
      subscriptionSent: () => false,
      noteUnboundLocalIntent: () => noted.push('noted'),
      docInputNames: () => null,
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      isPreMintBinding: () => false,
      docHasSubgraphDefinition: () => false
    })
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(noted).not.toEqual([])
  })

  it('survives the page holding no session at all', async () => {
    pageSession.value = null
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('stops minting once the page session is torn down', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    destroyAgentPageOpMinters()

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('re-attaches after a teardown, so a second page session mints again', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    destroyAgentPageOpMinters()
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('exposes no way for a panel close to stop the producer', () => {
    const handle = retainDocOpMinterForPage(transport, panelInputs())

    // The guard rule `op-producers-outlive-the-panel` enforces the call-site
    // half of this; the handle's shape is what makes the rule hard to defeat
    // by accident, so it is pinned rather than left to the type checker.
    expect(Object.keys(handle)).toEqual(['deliverHeldRestores'])
    expect('detach' in handle).toBe(false)
  })
})
