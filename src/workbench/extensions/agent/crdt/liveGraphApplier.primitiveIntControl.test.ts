import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { ComfyWidgets } from '@/scripts/widgets'
import { toNodeId } from '@/types/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

vi.mock(import('@/platform/telemetry/reportError'))

/**
 * Every case goes through the named (record) branch of `applyWidgets`. A
 * positional fixture cannot reach the missing-widget report, because that
 * branch derives its names from the live node, so it would pass vacuously.
 */

/**
 * `PrimitiveInt`'s only widget input, as `object_info` serves it:
 * `comfy_extras/nodes_primitive.py` passes
 * `control_after_generate=io.ControlAfterGenerate.fixed`, and that `str` Enum
 * serialises as its own value.
 */
const PRIMITIVE_INT_VALUE: InputSpec = [
  'INT',
  { default: 0, min: 0, max: 2147483647, control_after_generate: 'fixed' }
]

class PrimitiveInt extends LGraphNode {
  constructor() {
    super('PrimitiveInt')
    this.comfyClass = 'PrimitiveInt'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'value', PRIMITIVE_INT_VALUE, fromPartial({}))
    this.addOutput('INT', 'INT')
  }
}

const CATALOG: WidgetCatalog = {
  types: { PrimitiveInt: { widget_order: ['value', 'control_after_generate'] } }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

const WORKFLOW: WorkflowJSON = {
  nodes: [
    {
      id: 143,
      type: 'PrimitiveInt',
      pos: [0, 0],
      size: [210, 82],
      outputs: [{ name: 'INT', type: 'INT', links: [] }],
      // Deliberately not the constructor default `fixed`: keyed by the live
      // widget's name, a mismatch keeps the default and the assertion would
      // pass on the parent for the wrong reason.
      widgets_values: [5, 'increment']
    }
  ],
  links: []
}

function setup() {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(WORKFLOW, CATALOG)
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  const applyCollected = () =>
    applier.applyChanges(doc, collector.take(), CONTEXT)
  const applyEdit = (edit: () => void) => {
    doc.transact(edit)
    return applyCollected()
  }
  const docWidgets = (): Y.Map<unknown> => {
    const widgets = nodesMap(doc).get('143')?.get('widgets')
    if (!(widgets instanceof Y.Map)) throw new Error('not named storage')
    return widgets
  }
  return { graph, doc, applyCollected, applyEdit, docWidgets }
}

function liveWidgets(graph: LGraph): Record<string, unknown> {
  const node = graph.getNodeById(toNodeId(143))
  if (!node) throw new Error('node 143 was not created')
  return Object.fromEntries(
    (node.widgets ?? []).map((widget) => [widget.name, widget.value])
  )
}

beforeEach(() => {
  LiteGraph.registerNodeType('PrimitiveInt', PrimitiveInt)
})

describe('PrimitiveInt control_after_generate projection', () => {
  it('applies the catch-up frame to the control widget, not to a default', () => {
    // `createNode` keys the named record by *live* widget name, so a
    // disagreement here silently keeps the constructor default and emits no
    // telemetry at all — a second, quieter face of the same defect.
    const { graph, applyCollected, docWidgets } = setup()
    expect(Object.fromEntries(docWidgets().entries())).toEqual({
      value: 5,
      control_after_generate: 'increment'
    })

    applyCollected()

    const widgets = liveWidgets(graph)
    expect(widgets.value).toBe(5)
    expect(widgets.control_after_generate).toBe('increment')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('applies a later named control_after_generate change to the live widget', () => {
    const { graph, applyCollected, applyEdit, docWidgets } = setup()
    applyCollected()

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'decrement')
    })

    expect(liveWidgets(graph).control_after_generate).toBe('decrement')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('serialises back into the catalog slot order', () => {
    const { graph, applyCollected, applyEdit, docWidgets } = setup()
    applyCollected()
    const node = graph.getNodeById(toNodeId(143))
    if (!node) throw new Error('node 143 was not created')

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })
    expect(node.serialize().widgets_values).toEqual([5, 'randomize'])
  })

  it('positive control: a widget the live node really lacks is still reported', () => {
    const { applyCollected, applyEdit, docWidgets } = setup()
    applyCollected()

    applyEdit(() => {
      docWidgets().set('cfg', 8)
    })

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Node 143 (PrimitiveInt) has no widget 'cfg'"
      }),
      expect.objectContaining({
        errorType: 'agent_graph_widget_missing',
        context: expect.objectContaining({
          nodeId: '143',
          type: 'PrimitiveInt',
          name: 'cfg'
        }),
        tags: expect.objectContaining({
          layer: 'graph-api',
          subsystem: 'agent-crdt',
          outcome: 'degraded'
        })
      })
    )
  })
})
