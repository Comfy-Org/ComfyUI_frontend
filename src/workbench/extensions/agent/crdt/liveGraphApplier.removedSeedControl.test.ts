import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { InputSpec } from '@comfyorg/object-info-parser'
import { ComfyWidgets } from '@/scripts/widgets'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

/**
 * Seed nodes from popular packs (rgthree `Seed (rgthree)`, efficiency-nodes
 * `KSampler (Efficient)` / `KSampler Adv. (Efficient)` / `KSampler SDXL
 * (Eff.)`) let the frontend build its `control_after_generate` companion, then
 * splice it out in `onNodeCreated` and drive the seed themselves. The catalog,
 * built from `object_info`, still lists the slot, so the document names a
 * widget the live node removed on purpose.
 */
const SEED: InputSpec = [
  'INT',
  { default: 0, min: 0, max: 2147483647, control_after_generate: true }
]

class PackSeed extends LGraphNode {
  constructor() {
    super('PackSeed')
    this.comfyClass = 'PackSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }

  override onNodeCreated() {
    const index = this.widgets?.findIndex(
      (widget) => widget.name === 'control_after_generate'
    )
    if (index !== undefined && index >= 0) this.widgets?.splice(index, 1)
  }
}

class KeptSeed extends LGraphNode {
  constructor() {
    super('KeptSeed')
    this.comfyClass = 'KeptSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    PackSeed: { widget_order: ['seed', 'control_after_generate'] },
    KeptSeed: { widget_order: ['seed', 'control_after_generate'] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function workflow(type: string): WorkflowJSON {
  return {
    nodes: [
      {
        id: 7,
        type,
        pos: [0, 0],
        size: [210, 82],
        outputs: [{ name: 'INT', type: 'INT', links: [] }],
        widgets_values: [5, 'increment']
      }
    ],
    links: []
  }
}

function setup(type: string) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(workflow(type), CATALOG)
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  const applyCollected = () =>
    applier.applyChanges(doc, collector.take(), CONTEXT)
  const applyEdit = (edit: () => void) => {
    doc.transact(edit)
    return applyCollected()
  }
  const docWidgets = (): Y.Map<unknown> => {
    const widgets = nodesMap(doc).get('7')?.get('widgets')
    if (!(widgets instanceof Y.Map)) throw new Error('not named storage')
    return widgets
  }
  const liveNode = () => {
    const node = graph.getNodeById(toNodeId(7))
    if (!node) throw new Error('node 7 was not created')
    return node
  }
  return { applyCollected, applyEdit, docWidgets, liveNode }
}

const missingControlReport = (type: string) =>
  expect.objectContaining({
    message: `Node 7 (${type}) has no widget 'control_after_generate'`
  })

beforeEach(() => {
  LiteGraph.registerNodeType('PackSeed', PackSeed)
  LiteGraph.registerNodeType('KeptSeed', KeptSeed)
})

describe('a seed control the node removed on purpose', () => {
  it('applies the seed and does not report the removed control on catch-up', () => {
    const { applyCollected, liveNode } = setup('PackSeed')

    applyCollected()

    const node = liveNode()
    expect(node.widgets?.map((widget) => widget.name)).toEqual(['seed'])
    expect(node.widgets?.[0].value).toBe(5)
    expect(reportError).not.toHaveBeenCalledWith(
      missingControlReport('PackSeed'),
      expect.anything()
    )
  })

  it('does not report a later control_after_generate edit', () => {
    const { applyCollected, applyEdit, docWidgets } = setup('PackSeed')
    applyCollected()

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    expect(reportError).not.toHaveBeenCalledWith(
      missingControlReport('PackSeed'),
      expect.anything()
    )
  })

  it('positive control: other widgets the node lacks are still reported', () => {
    const { applyCollected, applyEdit, docWidgets } = setup('PackSeed')
    applyCollected()

    applyEdit(() => {
      docWidgets().set('cfg', 8)
    })

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Node 7 (PackSeed) has no widget 'cfg'"
      }),
      expect.objectContaining({ errorType: 'agent_graph_widget_missing' })
    )
  })

  it('positive control: a node that keeps its control still takes the mode', () => {
    const { applyCollected, applyEdit, docWidgets, liveNode } =
      setup('KeptSeed')
    applyCollected()

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'decrement')
    })

    const control = liveNode().widgets?.find(
      (widget) => widget.name === 'control_after_generate'
    )
    expect(control?.value).toBe('decrement')
    expect(reportError).not.toHaveBeenCalled()
  })
})
