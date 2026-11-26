import { fromPartial } from '@total-typescript/shoehorn'
import { EffectScope, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

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

const VISIBLE_WORKFLOW_ID = 'visible-workflow'

const held = shallowRef<AgentFollowerSession | null>(null)

vi.mock(import('./crdt/useAgentCrdtFollower'), () => ({
  retainedAgentFollowerSessionRef: () => held
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
  let identityListeners: (() => void)[]

  function panelInputs(
    overrides: Partial<AgentPanelOpMinterInputs> = {}
  ): AgentPanelOpMinterInputs {
    return {
      isEnabled: () => true,
      isTargetActive: () => true,
      getGraph: () => graph,
      isBoundWorkflow: (workflow) => workflow === boundWorkflow,
      boundRootGraphId: () => rootGraphId,
      visibleWorkflowIdFor: () => VISIBLE_WORKFLOW_ID,
      onIdentityChange: (listener) => {
        identityListeners.push(listener)
        return () => {
          identityListeners = identityListeners.filter(
            (candidate) => candidate !== listener
          )
        }
      },
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
    identityListeners = []
    held.value = fakeSession(minted)
  })

  afterEach(() => {
    destroyAgentPageOpMinters()
    held.value = null
  })

  it('mints an edit made after the panel released its follower lease', async () => {
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('resolves the page-held session per call, so a rebind redirects the mint', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    const rebound: GraphOperation[] = []
    held.value = fakeSession(rebound)

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

  it('holds the edit as unbound local intent while the document is not subscribed', async () => {
    const noted: string[] = []
    held.value = fromPartial<AgentFollowerSession>({
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
    held.value = null
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('routes an unbound visible edit to the page session, not the panel', async () => {
    const noted: string[] = []
    held.value = fromPartial<AgentFollowerSession>({
      status: shallowRef({ connected: true }),
      subscriptionSent: () => true,
      noteUnboundLocalIntent: (target?: string) => noted.push(String(target)),
      docInputNames: () => null,
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      isPreMintBinding: () => false,
      docHasSubgraphDefinition: () => false
    })
    retainDocOpMinterForPage(
      transport,
      panelInputs({
        boundRootGraphId: () => toRootGraphId('some-other-root-graph'),
        visibleWorkflowIdFor: (rootGraph) =>
          unboundVisibleIntents.push(rootGraph.id) ? VISIBLE_WORKFLOW_ID : null
      })
    )

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(unboundVisibleIntents).toEqual([graph.id])
    expect(noted).toEqual([VISIBLE_WORKFLOW_ID])
  })

  it('stops minting after an identity change until a panel reinstalls its inputs', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    for (const listener of identityListeners) listener()

    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])

    retainDocOpMinterForPage(transport, panelInputs())
    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted.map((operation) => operation.op)).toEqual(['add_node'])
  })

  it('reports the edit rather than dropping it when the claim goes before flush', async () => {
    retainDocOpMinterForPage(transport, panelInputs())

    graph.add(new TestSource())
    held.value = null
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'failure_syncing_agent_edit_undeliverable'
      }),
      expect.objectContaining({
        tags: expect.objectContaining({ code: 'no_page_session' })
      })
    )
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

  it('still detaches the producer when its scope disposal throws', async () => {
    retainDocOpMinterForPage(transport, panelInputs())
    vi.spyOn(EffectScope.prototype, 'stop').mockImplementationOnce(() => {
      throw new Error('scope stop failed')
    })

    destroyAgentPageOpMinters()
    graph.add(new TestSource())
    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'scope stop failed' }),
      expect.objectContaining({
        errorType: 'failure_detaching_agent_page_op_minter',
        tags: { step: 'scope' }
      })
    )
  })

  it('exposes no way for a panel close to stop the producer', () => {
    const handle = retainDocOpMinterForPage(transport, panelInputs())

    expect(Object.keys(handle)).toEqual(['deliverHeldRestores'])
    expect('detach' in handle).toBe(false)
  })
})
