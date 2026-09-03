import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TWidgetValue } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackNamedValuesShadowDiffMismatch: vi.fn(),
    trackNamedValuesShadowDiffSummary: vi.fn()
  })
}))

vi.mock('@/platform/nodeReplacement/cnrIdUtil', () => ({
  getCnrIdFromNode: () => undefined
}))

const NODE_TYPE = 'test/NullContractNode'
const DEFAULT_VALUE = 'default'

const nullSlotTypeContract = [30, null, 12345] satisfies NonNullable<
  ISerialisedNode['widgets_values']
>

function registerNullContractNode(): void {
  class NullContractNode extends LGraphNode {
    constructor() {
      super('Null Contract Node')
      this.serialize_widgets = true
      this.addWidget('text', 'prompt', DEFAULT_VALUE, () => undefined)
    }
  }
  LiteGraph.registerNodeType(NODE_TYPE, NullContractNode)
}

function makeGraphWithWidget(value: TWidgetValue): {
  graph: LGraph
  node: LGraphNode
} {
  const graph = new LGraph()
  const node = LiteGraph.createNode(NODE_TYPE)
  if (!node) throw new Error('failed to create the test node')
  graph.add(node)
  firstWidget(graph).value = value
  return { graph, node }
}

function roundTripGraphWithoutLiveWidgetState(graph: LGraph): LGraph {
  const text = JSON.stringify(graph.serialize())
  setActivePinia(createTestingPinia({ stubActions: false }))
  const reloaded = new LGraph()
  reloaded.configure(JSON.parse(text))
  return reloaded
}

function firstWidget(graph: LGraph) {
  const node = graph.nodes[0]
  const widget = node.widgets?.[0]
  if (!widget) throw new Error('expected a widget on the reloaded node')
  return widget
}

describe('widget value null contract', () => {
  const origNamedValuesRestore = LiteGraph.namedValuesRestore

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    registerNullContractNode()
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = origNamedValuesRestore
  })

  describe('LGraphNode.serialize (workflow write)', () => {
    it('writes a null widget value to widgets_values', () => {
      const { node } = makeGraphWithWidget(null)

      const serialized = node.serialize()

      expect(serialized.widgets_values).toEqual([null])
      expect(serialized.widgets_values_named).toEqual({ prompt: null })
    })

    it('mints null from an undefined widget value', () => {
      const { node } = makeGraphWithWidget(undefined)

      expect(node.serialize().widgets_values).toEqual([null])
    })

    it('mints null from a value JSON cannot represent as a number', () => {
      // The scalar fast path skips the JSON round-trip, so the cases that
      // depend on it — NaN and Infinity becoming null — have to stay on it.
      const { node } = makeGraphWithWidget(Number.NaN)

      expect(node.serialize().widgets_values).toEqual([null])
    })

    it('still honours widget.serialize === false for a null value', () => {
      const { node } = makeGraphWithWidget(null)
      const dropped = node.addWidget('text', 'dropped', 'b', () => undefined)
      dropped.value = null
      dropped.serialize = false

      const serialized = node.serialize()

      expect(serialized.widgets_values_named).toEqual({ prompt: null })
      expect(serialized.widgets_values_named).not.toHaveProperty('dropped')
    })
  })

  describe('LGraphNode.configure (workflow read)', () => {
    it('restores a typed null in the middle positional slot', () => {
      LiteGraph.namedValuesRestore = false
      const graph = new LGraph()
      const node = new LGraphNode('Three widgets')
      node.addWidget('number', 'first', 0, () => undefined)
      node.addWidget('number', 'nullable', 0, () => undefined)
      node.addWidget('number', 'third', 0, () => undefined)
      graph.add(node)

      node.configure({
        ...node.serialize(),
        widgets_values: nullSlotTypeContract
      })

      expect(node.widgets?.map(({ value }) => value)).toEqual([30, null, 12345])
    })

    it('restores a null widget value through the indexed path', () => {
      LiteGraph.namedValuesRestore = false
      const { graph } = makeGraphWithWidget(null)

      expect(
        firstWidget(roundTripGraphWithoutLiveWidgetState(graph)).value
      ).toBeNull()
    })

    it('restores a null widget value through the named-values path', () => {
      LiteGraph.namedValuesRestore = true
      const { graph, node } = makeGraphWithWidget(DEFAULT_VALUE)

      node.configure({
        ...node.serialize(),
        widgets_values: [DEFAULT_VALUE],
        widgets_values_named: { prompt: null }
      })

      expect(firstWidget(graph).value).toBeNull()
    })

    it('distinguishes a stored null from an absent value', () => {
      LiteGraph.namedValuesRestore = false
      const { graph, node } = makeGraphWithWidget(DEFAULT_VALUE)
      const base = node.serialize()

      node.configure({ ...base, widgets_values: [] })
      expect(firstWidget(graph).value).toBe(DEFAULT_VALUE)

      node.configure({ ...base, widgets_values: [null] })
      expect(firstWidget(graph).value).toBeNull()
    })
  })
})
