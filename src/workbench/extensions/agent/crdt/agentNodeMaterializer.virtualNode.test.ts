import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'
import type { GraphOperation } from './graphOperations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    rootGraph: { id: 'root' },
    canvas: {
      processMouseDown: vi.fn(),
      processMouseMove: vi.fn(),
      processMouseUp: vi.fn(),
      processMouseWheel: vi.fn()
    }
  })
}))

class NoteLikeNode extends LGraphNode {
  override isVirtualNode = true

  constructor(title: string) {
    super(title)
    ComfyWidgets.STRING(
      this,
      'text',
      ['STRING', { default: '', multiline: true }],
      app
    )
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    dummy: { widget_order: [] }
  }
}

function agentOperation(
  id: string,
  version: number,
  payload: GraphOperation
): Op {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test'],
    ...payload
  }
}

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    placement: inertPlacementPort,
    getScope: () => scope,
    layout: { createNode: () => {}, deleteNodes: () => {} }
  })
}

function notePayload(id: number, widgetsValues: unknown[]) {
  return {
    id,
    type: 'Note',
    pos: [10, 20],
    size: [300, 200],
    inputs: [],
    outputs: [],
    widgets_values: widgetsValues
  }
}

function bindFollower(graph: LGraph) {
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(remoteMutations(graphScopeOf(graph)))
  adapter.bind('workflow', follower)
  return { follower, adapter }
}

beforeEach(() => {
  LiteGraph.registerNodeType('Note', NoteLikeNode)
})

describe('virtual node with opaque positional widgets_values', () => {
  it('materializes an agent-added Note with its text widget populated', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const { follower, adapter } = bindFollower(graph)

    const opId = 'agent-op-1'
    const result = applyOps(
      host,
      [
        agentOperation(opId, 1, {
          op: 'add_node',
          node_id: 1,
          class_type: 'Note',
          pos: [10, 20],
          node: notePayload(1, ['hello from the agent'])
        })
      ],
      CATALOG
    )
    expect(result.outcomes).toEqual([{ op_id: opId, outcome: 'applied' }])

    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow',
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: [opId]
      })
    ).toBe(true)

    expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])

    const node = graph.getNodeById(toNodeId(1))
    expect(node).toBeInstanceOf(NoteLikeNode)
    expect(node?.has_errors).toBeFalsy()
    expect(node?.widgets?.map(({ name }) => name)).toEqual(['text'])
    expect(node?.widgets?.[0]?.value).toBe('hello from the agent')

    const domWidgets = [...useDomWidgetStore().widgetStates.values()]
    expect(domWidgets.map((state) => state.widget.name)).toEqual(['text'])

    const records = useWidgetValueStore().getNodeWidgets(
      scope.rootGraphId,
      toNodeId(1)
    )
    expect(records.find(({ name }) => name === 'text')?.value).toBe(
      'hello from the agent'
    )
  })

  it('materializes a human-minted Note from the initial frame with its text', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const host = mint(
      { nodes: [notePayload(1, ['minted by a human'])], links: [] },
      CATALOG
    )
    const { follower, adapter } = bindFollower(graph)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow',
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: []
      })
    ).toBe(true)

    expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])

    const node = graph.getNodeById(toNodeId(1))
    expect(node?.widgets?.map(({ name }) => name)).toEqual(['text'])
    expect(node?.widgets?.[0]?.value).toBe('minted by a human')
    const records = useWidgetValueStore().getNodeWidgets(
      scope.rootGraphId,
      toNodeId(1)
    )
    expect(records.find(({ name }) => name === 'text')?.value).toBe(
      'minted by a human'
    )
  })

  it('materializes a Note added with an empty widgets_values array with an empty text widget', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const { follower, adapter } = bindFollower(graph)

    const opId = 'agent-op-1'
    const result = applyOps(
      host,
      [
        agentOperation(opId, 1, {
          op: 'add_node',
          node_id: 1,
          class_type: 'Note',
          pos: [10, 20],
          node: notePayload(1, [])
        })
      ],
      CATALOG
    )
    expect(result.outcomes).toEqual([{ op_id: opId, outcome: 'applied' }])
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    adapter.applyFrame({
      workflowId: 'workflow',
      seq: 1,
      update,
      actor: 'agent:test',
      opIds: [opId]
    })

    reconcileAgentAdapters(graph)

    const node = graph.getNodeById(toNodeId(1))
    expect(node).toBeInstanceOf(NoteLikeNode)
    expect(node?.widgets?.map(({ name }) => name)).toEqual(['text'])
    expect(node?.widgets?.[0]?.value).toBe('')
  })
})
