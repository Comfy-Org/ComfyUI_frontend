import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import type { TWidgetValue } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackNamedValuesShadowDiffMismatch: vi.fn(),
    trackNamedValuesShadowDiffSummary: vi.fn()
  })
}))

vi.mock('@/platform/nodeReplacement/cnrIdUtil', () => ({
  getCnrIdFromNode: () => undefined
}))

/**
 * `null` is a legal widget value.
 *
 * `WidgetValue` (src/types/simplifiedWidget.ts) and `NodeProperty`
 * (src/lib/litegraph/src/LGraphNode.ts) both admit `null`, `setProperty(name,
 * null)` propagates it to the bound widget, and `LGraphNode.serialize()`
 * actively mints it — an `undefined` widget value is written to
 * `widgets_values` as `null` via `val ?? null`. Every persistence path
 * therefore has to round-trip `null` unchanged.
 *
 * These tests pin that contract on the workflow-write and workflow-read paths.
 * The subgraph promoted-widget path is covered in
 * `subgraph/SubgraphWidgetPromotion.test.ts`; the API prompt path in
 * `src/utils/executionUtil.test.ts`; the load-time schema in
 * `src/platform/workflow/validation/schemas/workflowSchema.test.ts`.
 *
 * See ADR 0016 (docs/adr/0016-null-is-a-legal-widget-value.md).
 */

const NODE_TYPE = 'test/NullContractNode'
const DEFAULT_VALUE = 'default'

/** Registers a node type that builds its own widget, so a reloaded graph has one. */
function registerNullContractNode(): void {
  class NullContractNode extends LGraphNode {
    constructor() {
      super('Null Contract Node')
      this.serialize_widgets = true
      this.addWidget('text', 'prompt', DEFAULT_VALUE, () => undefined)
    }
  }
  LiteGraph.registerNodeType(NODE_TYPE, NullContractNode)
  onTestFinished(() => LiteGraph.unregisterNodeType(NODE_TYPE))
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

/** Save → JSON text → load. */
function roundTripGraph(graph: LGraph): LGraph {
  const text = JSON.stringify(graph.serialize())
  // Widget state is keyed `graphId:nodeId:name` and `configure()` restores the
  // original graph id, so a reloaded widget re-adopts the live store entry.
  // Without dropping the store here the reload never reads the JSON at all.
  setActivePinia(createTestingPinia({ stubActions: false }))
  const reloaded = new LGraph()
  reloaded.configure(JSON.parse(text))
  return reloaded
}

function firstWidget(graph: LGraph) {
  const node = graph.nodes[0]
  if (!node) throw new Error('expected a node in the reloaded graph')
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
      // `val ?? null` in LGraphNode.serialize. This is why null is already
      // present in first-party workflow JSON, with no extension involved.
      const { node } = makeGraphWithWidget(undefined)

      expect(node.serialize().widgets_values).toEqual([null])
    })

    it('still honours widget.serialize === false for a null value', () => {
      // Control arm: the one filter this path is supposed to apply. If this
      // passes while the tests above pass, the write path is filtering on
      // `serialize`, not on nullness.
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
    it('restores a null widget value through the indexed path', () => {
      LiteGraph.namedValuesRestore = false
      const { graph } = makeGraphWithWidget(null)

      expect(firstWidget(roundTripGraph(graph)).value).toBeNull()
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
      // Control arm with a known-non-zero counterpart: an absent entry leaves
      // the widget default alone, a present null overwrites it. Without the
      // first assertion, the second proves nothing.
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
