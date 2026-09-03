import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowNode
} from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import * as fc from 'fast-check'
import { setActivePinia } from 'pinia'
import { toRaw } from 'vue'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { widgetId } from '@/types/widgetId'

import type { DocUpdate } from './docFrameClient'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: ['seed'] },
    Sink: { widget_order: ['strength'] }
  }
}
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const propertyOptions = { seed: 0x0fe0c8, numRuns: 100 } as const

interface Scenario {
  nodeCount: number
  positions: number[]
  sizes: number[]
  widgetValues: number[]
  moveMask: boolean[]
  deleteMask: boolean[]
  orderKeys: number[]
  batchSizes: number[]
}

interface Projection {
  nodes: unknown[]
  links: unknown[]
  widgets: unknown[]
  layouts: unknown[]
}

const scenarioArbitrary: fc.Arbitrary<Scenario> = fc.record({
  nodeCount: fc.integer({ min: 2, max: 8 }),
  positions: fc.array(fc.integer({ min: -1000, max: 1000 }), {
    minLength: 16,
    maxLength: 16
  }),
  sizes: fc.array(fc.integer({ min: 32, max: 512 }), {
    minLength: 16,
    maxLength: 16
  }),
  widgetValues: fc.array(fc.integer(), {
    minLength: 8,
    maxLength: 8
  }),
  moveMask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
  deleteMask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
  orderKeys: fc.array(fc.integer(), { minLength: 40, maxLength: 40 }),
  batchSizes: fc.array(fc.integer({ min: 1, max: 5 }), {
    minLength: 1,
    maxLength: 8
  })
})

function envelope(index: number) {
  const actor = `agent:property:${index % 3}`
  const opId = index.toString(16).padStart(32, '0')
  return {
    op_id: opId,
    actor,
    base_version: index,
    stamp: [index, actor] as [number, string]
  }
}

function workflowNode(
  id: number,
  type: 'Source' | 'Sink',
  position: readonly [number, number],
  size: readonly [number, number]
): WorkflowNode {
  return {
    id,
    type,
    pos: [...position],
    size: [...size],
    inputs: type === 'Sink' ? [{ name: 'in', type: 'IMAGE', link: null }] : [],
    outputs:
      type === 'Source' ? [{ name: 'out', type: 'IMAGE', links: [] }] : [],
    widgets_values: { [type === 'Source' ? 'seed' : 'strength']: 0 }
  }
}

function phases(scenario: Scenario): Op[][] {
  let serial = 1
  const ids = Array.from(
    { length: scenario.nodeCount },
    (_, index) => 100 + index
  )
  const adds = ids.map((id, index) => {
    const type: 'Source' | 'Sink' = index % 2 === 0 ? 'Source' : 'Sink'
    const position = [
      scenario.positions[index * 2],
      scenario.positions[index * 2 + 1]
    ] as const
    const size = [
      scenario.sizes[index * 2],
      scenario.sizes[index * 2 + 1]
    ] as const
    return {
      ...envelope(serial++),
      op: 'add_node',
      node_id: id,
      class_type: type,
      pos: [...position],
      node: workflowNode(id, type, position, size)
    } satisfies Op
  })
  const moves = ids.flatMap((id, index) => {
    if (!scenario.moveMask[index]) return []
    const type: 'Source' | 'Sink' = index % 2 === 0 ? 'Source' : 'Sink'
    const position = [
      scenario.positions[index * 2] + 17,
      scenario.positions[index * 2 + 1] - 23
    ] as const
    const size = [
      scenario.sizes[index * 2],
      scenario.sizes[index * 2 + 1]
    ] as const
    return [
      {
        ...envelope(serial++),
        op: 'add_node',
        node_id: id,
        class_type: type,
        pos: [...position],
        node: workflowNode(id, type, position, size)
      } satisfies Op
    ]
  })
  const widgets = ids.map((id, index) => ({
    ...envelope(serial++),
    op: 'set_widget',
    node_id: id,
    widget: index % 2 === 0 ? 'seed' : 'strength',
    value: scenario.widgetValues[index],
    path: null,
    inner_widget: null
  })) satisfies Op[]
  const connects = Array.from(
    { length: Math.floor(ids.length / 2) },
    (_, index) =>
      ({
        ...envelope(serial++),
        op: 'connect',
        link_id: 1000 + index,
        from_node: ids[index * 2],
        from_slot: 0,
        to_node: ids[index * 2 + 1],
        to_slot: 0,
        link_type: 'IMAGE'
      }) satisfies Op
  )
  const deletes = ids.flatMap((id, index) => {
    if (index % 2 !== 0 || !scenario.deleteMask[index]) return []
    return [
      {
        ...envelope(serial++),
        op: 'delete_node',
        node_id: id,
        removed_links: index + 1 < ids.length ? [1000 + index / 2] : []
      } satisfies Op
    ]
  })
  return [adds, moves, widgets, connects, deletes].filter(
    (phase) => phase.length > 0
  )
}

function permutePhases(causalPhases: Op[][], keys: number[]): Op[] {
  let offset = 0
  return causalPhases.flatMap((phase) => {
    const ordered = phase
      .map((operation, index) => ({
        operation,
        key: keys[(offset + index) % keys.length]
      }))
      .sort(
        (left, right) =>
          left.key - right.key ||
          left.operation.op_id.localeCompare(right.operation.op_id)
      )
      .map(({ operation }) => operation)
    offset += phase.length
    return ordered
  })
}

function jsonSnapshot(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function projection(): Projection {
  const nodeStates = useNodeDataStore()
    .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  const nodes = nodeStates
    .map((node) => jsonSnapshot(toRaw(node)))
    .filter((node): node is Record<string, unknown> => node !== null)
  const links = [...useLinkStore().graphTopologies(scope)]
    .map((link) => jsonSnapshot(toRaw(link)))
    .filter((link): link is Record<string, unknown> => link !== null)
    .sort((left, right) => Number(left.id) - Number(right.id))
  const widgetStore = useWidgetValueStore()
  const widgets = nodeStates.flatMap((node) => {
    const name = node.type === 'Source' ? 'seed' : 'strength'
    const id = widgetId(scope.rootGraphId, node.id, name)
    const state = widgetStore.getWidget(id)
    return state ? [[id, jsonSnapshot(toRaw(state))]] : []
  })
  const layouts = nodeStates.map((node) => [
    node.id,
    jsonSnapshot(layoutStore.getNodeLayout(scope.rootGraphId, node.id))
  ])
  return { nodes, links, widgets, layouts }
}

function consume(ops: Op[], batchSizes: number[]): Projection {
  setActivePinia(createTestingPinia({ stubActions: false }))
  layoutStore.resetForTests()

  const seed = Y.encodeStateAsUpdate(mint({ nodes: [], links: [] }, catalog))
  const host = new Y.Doc()
  Y.applyUpdate(host, seed)
  const follower = new FollowerDoc()
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode(graphScope, nodeId, layout, context) {
        const { position, size } = layout
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: graphScope.rootGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: 0,
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: 0
        })
      },
      deleteNodes(graphScope, nodeIds, context) {
        layoutStore.applyOperations(
          nodeIds.map((nodeId) => ({
            type: 'deleteNode',
            graphId: graphScope.rootGraphId,
            nodeId,
            source: LayoutSource.AgentRemote,
            actor: context.actor,
            opId: context.opId,
            timestamp: 0
          }))
        )
      }
    }
  })
  const adapter = new EcsFollowerAdapter(mutations)
  adapter.bind('property-workflow', follower)
  let sequence = 0
  let cursor = 0
  let batchIndex = 0

  while (cursor < ops.length) {
    const before = Y.encodeStateVector(host)
    const size = batchSizes[batchIndex++ % batchSizes.length]
    const batch = ops.slice(cursor, cursor + size)
    const result = applyOps(host, batch, catalog)
    expect(
      result.outcomes.find(({ outcome }) => outcome === 'rejected')
    ).toBeUndefined()
    const update = Y.encodeStateAsUpdate(host, before)
    follower.applyRemoteUpdate(update)
    const frame: DocUpdate = {
      workflowId: 'property-workflow',
      seq: ++sequence,
      update,
      actor: 'agent:property',
      opIds: batch.map(({ op_id }) => op_id)
    }
    expect(adapter.applyFrame(frame)).toBe(true)
    cursor += batch.length
  }

  const result = projection()
  adapter.destroy()
  follower.destroy()
  host.destroy()
  return result
}

describe('FE follower projection convergence (property)', () => {
  it('converges across causal arrival orders', () => {
    fc.assert(
      fc.property(scenarioArbitrary, (scenario) => {
        const causalPhases = phases(scenario)
        const forward = causalPhases.flat()
        const reordered = permutePhases(causalPhases, scenario.orderKeys)

        expect(consume(reordered, [1])).toEqual(consume(forward, [1]))
      }),
      propertyOptions
    )
  })
})
