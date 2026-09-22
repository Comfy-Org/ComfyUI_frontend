/**
 * Frontend-only ("virtual") node classes such as `Note` never appear in
 * `object_info`, so the pinned widget catalog has no `widget_order` for them.
 * comfy-multi-player stores their positional `widgets_values` whole under
 * `__widgets_opaque` and round-trips the array verbatim. This suite pins the
 * follower + materializer behaviour for that shape: the live node must end
 * up with its constructor-created widget populated from the opaque array.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
// Test-only: builds the fixture with the real renderer-owned STRING widget
// constructor so it registers a DOM widget exactly as `Comfy.NoteNode` does.
// eslint-disable-next-line import-x/no-restricted-paths
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
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

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: { id: 'root' },
    canvas: {
      processMouseDown: vi.fn(),
      processMouseMove: vi.fn(),
      processMouseUp: vi.fn(),
      processMouseWheel: vi.fn()
    }
  }
}))

/**
 * Same construction as `Comfy.NoteNode` in `extensions/core/noteNode.ts`: a
 * multiline STRING DOM widget named `text`, `serialize_widgets`, virtual.
 */
class NoteLikeNode extends LGraphNode {
  override isVirtualNode = true

  constructor(title: string) {
    super(title)
    useStringWidget()(this, {
      type: 'STRING',
      name: 'text',
      default: '',
      multiline: true
    })
    this.serialize_widgets = true
  }
}

/** Pinned catalog with no entry for the virtual class, as in production. */
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
    layout: {
      createNode(scope, nodeId, { position, size }, context) {
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: layoutStore.allocateZIndex(),
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: Date.now()
        })
      },
      deleteNodes(scope, nodeIds, context) {
        const timestamp = Date.now()
        layoutStore.applyOperations(
          nodeIds.map((nodeId) => ({
            type: 'deleteNode',
            graphId: scope.rootGraphId,
            ownerGraphId: scope.owningGraphId,
            nodeId,
            source: LayoutSource.AgentRemote,
            actor: context.actor,
            opId: context.opId,
            timestamp
          }))
        )
      }
    }
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

    // The DOM widget must be registered so the textarea renders.
    const domWidgets = [...useDomWidgetStore().widgetStates.values()]
    expect(domWidgets.map((state) => state.widget.name)).toEqual(['text'])

    // The store record addressed by the widget's real name carries the value.
    // `createNodeFromPayload` also registers a positional placeholder record
    // named "0" for uncatalogued widgets; cleaning that up is tracked as a
    // separate follow-up, so this test does not pin the exact record set.
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
