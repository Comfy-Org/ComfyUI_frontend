import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'

import {
  DummyNode,
  LateTwoWidgetNode,
  LateWidgetNode,
  REMOTE,
  ThreeWidgetNode,
  TwoWidgetNode,
  nodePayload,
  remoteMutations,
  seedAgentAddedNode,
  setupMaterializerFixtures
} from './__fixtures__/agentNodeMaterializer'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  setupMaterializerFixtures()
})

describe('reconcileAgentAdapters', () => {
  describe('store record without a live node', () => {
    it('gives the record a live node under its own id', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1)
      expect(graph._nodes).toHaveLength(0)

      const materialized = reconcileAgentAdapters(graph)

      expect(materialized).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(toNodeId(1))?.id).toBe(toNodeId(1))
      // `_nodes` alone does not exercise the save path; a regression in
      // `serialiseStoredNodes()` shows up here.
      expect(graph.serialize().nodes).toHaveLength(1)
      expect(reportError).not.toHaveBeenCalled()
    })

    it.for([{ value: 7 }, [7]])(
      'retains %j through a partial reconcile before materializing',
      (widgets_values) => {
        const graph = new LGraph()
        const scope = graphScopeOf(graph)
        const mutations = remoteMutations(scope)
        mutations.addNode(
          { ...nodePayload(1, 'widget-node'), widgets_values: { value: 3 } },
          REMOTE
        )
        expect(
          mutations.batch(REMOTE, (batch) => {
            batch.reconcileNode({
              ...nodePayload(1, 'widget-node'),
              widgets_values
            })
            batch.reconcileNode({
              ...nodePayload(1, 'widget-node'),
              pos: [10, 20]
            })
          })
        ).toBe(true)

        reconcileAgentAdapters(graph)

        const node = graph.getNodeById(toNodeId(1))
        expect(node?.widgets?.[0].value).toBe(7)
        expect(
          useWidgetValueStore().getWidget(
            widgetId(scope.rootGraphId, toNodeId(1), 'value')
          )?.value
        ).toBe(7)
      }
    )

    it.for([{ value: 4 }, [4]])(
      'materializes the incremental value after reconciling %j without widgets',
      (widgets_values) => {
        const graph = new LGraph()
        const mutations = remoteMutations(graphScopeOf(graph))
        const payload = nodePayload(1, 'widget-node')
        mutations.addNode({ ...payload, widgets_values: { value: 3 } }, REMOTE)
        expect(
          mutations.batch(REMOTE, (batch) => {
            batch.reconcileNode({ ...payload, widgets_values })
            batch.setWidget(toNodeId(1), 'value', 7)
            batch.reconcileNode({ ...payload, pos: [10, 20] })
          })
        ).toBe(true)

        reconcileAgentAdapters(graph)

        expect(graph.getNodeById(toNodeId(1))?.widgets?.[0].value).toBe(7)
      }
    )

    it.for([{ emptyValues: [] }, { emptyValues: {} }])(
      'preserves missing-node values on save and reload until cleared with $emptyValues',
      ({ emptyValues }) => {
        const graph = new LGraph()
        const mutations = remoteMutations(graphScopeOf(graph))
        const payload = nodePayload(1, 'unregistered-widget-node')
        graph.configure({
          ...graph.asSerialisable(),
          nodes: [
            {
              ...new LGraphNode('Missing').serialize(),
              id: 1,
              type: payload.type,
              widgets_values: [4],
              widgets_values_named: { seed: 4 }
            }
          ]
        })

        expect(
          mutations.batch(REMOTE, (batch) =>
            batch.reconcileNode({ ...payload, pos: [10, 20] })
          )
        ).toBe(true)
        const saved = graph.serialize()
        expect(saved.nodes[0]).toMatchObject({
          widgets_values: [4],
          widgets_values_named: { seed: 4 }
        })
        graph.configure(saved)
        expect(graph.serialize().nodes[0]).toMatchObject({
          widgets_values: [4],
          widgets_values_named: { seed: 4 }
        })

        expect(
          mutations.batch(REMOTE, (batch) => {
            batch.reconcileNode({ ...payload, widgets_values: emptyValues })
            batch.reconcileNode(payload)
          })
        ).toBe(true)
        expect(graph.serialize().nodes[0].widgets_values).toEqual(emptyValues)
        expect(graph.serialize().nodes[0].widgets_values_named).toBeUndefined()
      }
    )

    it('keeps an incremental setWidget in the named record through an omitted-widget reconcile, save and reload, and rebinds it when the type registers', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      const mutations = remoteMutations(scope)
      const payload = nodePayload(1, 'late-widget-node')
      graph.configure({
        ...graph.asSerialisable(),
        nodes: [
          {
            ...new LGraphNode('Missing').serialize(),
            id: 1,
            type: payload.type,
            widgets_values: [4],
            widgets_values_named: { value: 4 }
          }
        ]
      })

      expect(
        mutations.batch(REMOTE, (batch) =>
          batch.setWidget(toNodeId(1), 'value', 7)
        )
      ).toBe(true)
      expect(
        mutations.batch(REMOTE, (batch) =>
          batch.reconcileNode({ ...payload, pos: [10, 20] })
        )
      ).toBe(true)

      const saved = graph.serialize()
      expect(saved.nodes[0]).toMatchObject({
        widgets_values: [4],
        widgets_values_named: { value: 7 }
      })
      graph.configure(saved)
      expect(graph.serialize().nodes[0]).toMatchObject({
        widgets_values: [4],
        widgets_values_named: { value: 7 }
      })

      LiteGraph.registerNodeType('late-widget-node', LateWidgetNode)
      try {
        reconcileAgentAdapters(graph)
        const node = graph.getNodeById(toNodeId(1))
        expect(node).toBeInstanceOf(LateWidgetNode)
        expect(node?.widgets?.map((widget) => widget.value)).toEqual([7])
        expect(graph.serialize().nodes[0]).toMatchObject({
          widgets_values: [7],
          widgets_values_named: { value: 7 }
        })
        expect(
          useWidgetValueStore()
            .getNodeWidgets(scope.rootGraphId, toNodeId(1))
            .map((widget) => widget.name)
        ).toEqual(['value'])
      } finally {
        LiteGraph.unregisterNodeType('late-widget-node')
      }
    })

    it('keeps the positional array as saved for a two-widget missing node and rebinds both values by name', () => {
      const graph = new LGraph()
      const mutations = remoteMutations(graphScopeOf(graph))
      const payload = nodePayload(1, 'late-two-widget-node')
      graph.configure({
        ...graph.asSerialisable(),
        nodes: [
          {
            ...new LGraphNode('Missing').serialize(),
            id: 1,
            type: payload.type,
            widgets_values: [20, 4],
            widgets_values_named: { seed: 4, steps: 20 }
          }
        ]
      })

      expect(
        mutations.batch(REMOTE, (batch) =>
          batch.setWidget(toNodeId(1), 'seed', 7)
        )
      ).toBe(true)
      expect(
        mutations.batch(REMOTE, (batch) =>
          batch.reconcileNode({ ...payload, pos: [10, 20] })
        )
      ).toBe(true)

      const saved = graph.serialize()
      expect(saved.nodes[0]).toMatchObject({
        widgets_values: [20, 4],
        widgets_values_named: { seed: 7, steps: 20 }
      })
      graph.configure(saved)

      LiteGraph.registerNodeType('late-two-widget-node', LateTwoWidgetNode)
      try {
        reconcileAgentAdapters(graph)
        const node = graph.getNodeById(toNodeId(1))
        expect(node).toBeInstanceOf(LateTwoWidgetNode)
        expect(node?.widgets?.map((widget) => widget.value)).toEqual([20, 7])
        expect(graph.serialize().nodes[0]).toMatchObject({
          widgets_values: [20, 7],
          widgets_values_named: { seed: 7, steps: 20 }
        })
      } finally {
        LiteGraph.unregisterNodeType('late-two-widget-node')
      }
    })

    it('rebinds a placeholder in place and keeps its canonical link', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      graph.configure({
        ...graph.asSerialisable(),
        nodes: [
          {
            ...new LGraphNode('Missing').serialize(),
            id: 1,
            type: 'late-two-widget-node',
            inputs: [{ name: 'in', type: '*', link: null }],
            widgets_values: [20, 4],
            widgets_values_named: { seed: 4, steps: 20 }
          }
        ]
      })
      const upstream = new LGraphNode('Upstream')
      upstream.addOutput('out', '*')
      graph.add(upstream)
      expect(
        remoteMutations(scope).connect(
          {
            id: 9,
            originNodeId: upstream.id,
            originSlot: 0,
            targetNodeId: 1,
            targetSlot: 0,
            type: '*',
            targetInputs: [{ name: 'in', type: '*', link: 9 }]
          },
          REMOTE
        )
      ).toBe(true)

      LiteGraph.registerNodeType('late-two-widget-node', LateTwoWidgetNode)
      try {
        reconcileAgentAdapters(graph)
        const node = graph.getNodeById(toNodeId(1))
        expect(node).toBeInstanceOf(LateTwoWidgetNode)
        expect(useLinkStore().getInputSlotLink(scope, toNodeId(1), 0)?.id).toBe(
          toLinkId(9)
        )
        expect(node?.inputs[0]?.link).toBe(toLinkId(9))
        expect(node?.getInputLink(0)?.id).toBe(toLinkId(9))
      } finally {
        LiteGraph.unregisterNodeType('late-two-widget-node')
      }
    })

    it('never rewrites a sibling slot after an ambiguous write', () => {
      const graph = new LGraph()
      const mutations = remoteMutations(graphScopeOf(graph))
      graph.configure({
        ...graph.asSerialisable(),
        nodes: [
          {
            ...new LGraphNode('Missing').serialize(),
            id: 1,
            type: 'late-three-widget-node',
            widgets_values: [4, 4, 7],
            widgets_values_named: { a: 4, b: 4, c: 7 }
          }
        ]
      })

      expect(
        mutations.batch(REMOTE, (batch) => {
          batch.setWidget(toNodeId(1), 'a', 7)
          batch.setWidget(toNodeId(1), 'a', 9)
          batch.reconcileNode(nodePayload(1, 'late-three-widget-node'))
        })
      ).toBe(true)

      expect(graph.serialize().nodes[0]).toMatchObject({
        widgets_values: [4, 4, 7],
        widgets_values_named: { a: 9, b: 4, c: 7 }
      })

      LiteGraph.registerNodeType('late-three-widget-node', ThreeWidgetNode)
      try {
        reconcileAgentAdapters(graph)
        expect(
          graph.getNodeById(toNodeId(1))?.widgets?.map((widget) => widget.value)
        ).toEqual([9, 4, 7])
      } finally {
        LiteGraph.unregisterNodeType('late-three-widget-node')
      }
    })

    it('restores a value written before the adapter existed over the positional snapshot', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      const mutations = remoteMutations(scope)
      mutations.addNode(
        { ...nodePayload(1, 'two-widget-node'), widgets_values: [20, 4] },
        REMOTE
      )
      expect(
        mutations.batch(REMOTE, (batch) =>
          batch.setWidget(toNodeId(1), 'seed', 7)
        )
      ).toBe(true)

      reconcileAgentAdapters(graph)

      const node = graph.getNodeById(toNodeId(1))
      expect(node).toBeInstanceOf(TwoWidgetNode)
      expect(node?.widgets?.map((widget) => widget.value)).toEqual([20, 7])
      expect(graph.serialize().nodes[0].widgets_values).toEqual([20, 7])
    })

    it('materializes positional slots that a partial named record does not name', () => {
      const graph = new LGraph()
      remoteMutations(graphScopeOf(graph)).addNode(
        {
          ...nodePayload(1, 'two-widget-node'),
          widgets_values: [20, 4],
          widgets_values_named: { steps: 20 }
        },
        REMOTE
      )

      reconcileAgentAdapters(graph)

      expect(
        graph.getNodeById(toNodeId(1))?.widgets?.map((widget) => widget.value)
      ).toEqual([20, 4])
    })

    it('fills a positional slot whose widget name shadows an Object.prototype key', () => {
      class PrototypeNamedWidgetNode extends LGraphNode {
        constructor() {
          super('prototype-named-widget-node')
          this.serialize_widgets = true
          this.addWidget('number', 'constructor', 0, () => {})
          this.addWidget('number', 'seed', 0, () => {})
        }
      }
      const graph = new LGraph()
      remoteMutations(graphScopeOf(graph)).addNode(
        {
          ...nodePayload(1, 'prototype-named-widget-node'),
          widgets_values: [11, 4],
          widgets_values_named: { seed: 4 }
        },
        REMOTE
      )

      LiteGraph.registerNodeType(
        'prototype-named-widget-node',
        PrototypeNamedWidgetNode
      )
      try {
        reconcileAgentAdapters(graph)
        expect(
          graph.getNodeById(toNodeId(1))?.widgets?.map((widget) => widget.value)
        ).toEqual([11, 4])
      } finally {
        LiteGraph.unregisterNodeType('prototype-named-widget-node')
      }
    })

    it('is idempotent once the node is live', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const node = graph.getNodeById(toNodeId(1))
      const state = node?._state

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual([node])
      expect(node?._state).toBe(state)
      expect(useNodeDataStore().ownsNode(scope, state!)).toBe(true)
    })

    it('restores named combo and text values before onConfigure', () => {
      const observed: unknown[] = []
      class NamedWidgetNode extends LGraphNode {
        constructor() {
          super('named-widgets')
          this.addWidget('combo', 'model', 'default', () => {}, {
            values: ['default', 'chosen']
          })
          this.addWidget('text', 'prompt', '', () => {})
        }
        override onConfigure() {
          observed.push(this.widgets?.map(({ value }) => value))
        }
      }
      LiteGraph.registerNodeType('named-widgets', NamedWidgetNode)
      const previous = LiteGraph.namedValuesRestore
      LiteGraph.namedValuesRestore = false
      try {
        const graph = new LGraph()
        remoteMutations(graphScopeOf(graph)).addNode(
          {
            ...nodePayload(1, 'named-widgets'),
            widgets_values: { model: 'chosen', prompt: 'Preserve this prompt' }
          },
          REMOTE
        )

        reconcileAgentAdapters(graph)

        expect(observed).toEqual([['chosen', 'Preserve this prompt']])
        expect(
          graph.getNodeById(toNodeId(1))?.widgets?.map(({ value }) => value)
        ).toEqual(['chosen', 'Preserve this prompt'])
        expect(LiteGraph.namedValuesRestore).toBe(false)
      } finally {
        LiteGraph.namedValuesRestore = previous
        LiteGraph.unregisterNodeType('named-widgets')
      }
    })

    it('leaves a locally added node alone', () => {
      const graph = new LGraph()
      graph.add(new DummyNode())
      const deleteSpy = vi.spyOn(useNodeDataStore(), 'deleteNode')

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(deleteSpy).not.toHaveBeenCalled()
      expect(graph._nodes).toHaveLength(1)
    })

    it('builds an error placeholder for an unregistered type', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1, 'not-a-registered-type')

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      const node = graph.getNodeById(toNodeId(1))
      expect(node?.has_errors).toBe(true)
      expect(node?.type).toBe('not-a-registered-type')
      expect(node?.serialize()).toMatchObject({
        id: 1,
        type: 'not-a-registered-type'
      })
    })

    it('rebinds the placeholder it built for a remote add once the type registers', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'late-widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )
      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      const placeholder = graph.getNodeById(toNodeId(1))
      expect(placeholder?.constructor).toBe(LGraphNode)

      LiteGraph.registerNodeType('late-widget-node', LateWidgetNode)
      try {
        expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
        const node = graph.getNodeById(toNodeId(1))
        expect(node).toBeInstanceOf(LateWidgetNode)
        expect(node?.widgets?.[0]).toMatchObject({ name: 'value', value: 7 })
        expect(graph._nodes).toHaveLength(1)
      } finally {
        LiteGraph.unregisterNodeType('late-widget-node')
      }
    })
  })
})
