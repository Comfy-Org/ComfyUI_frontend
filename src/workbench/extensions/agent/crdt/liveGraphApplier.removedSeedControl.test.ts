import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { InputSpec } from '@comfyorg/object-info-parser'
import { transformInputSpecV1ToV2 } from '@comfyorg/object-info-parser/migration'
import { ComfyWidgets } from '@/scripts/widgets'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

const SEED: InputSpec = [
  'INT',
  { default: 0, min: 0, max: 2147483647, control_after_generate: true }
]

const PREFIXED_SEED: InputSpec = [
  'INT',
  {
    default: 0,
    min: 0,
    max: 2147483647,
    control_after_generate: true,
    control_prefix: 'Sampler'
  }
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

class RenamedSeed extends LGraphNode {
  constructor() {
    super('RenamedSeed')
    this.comfyClass = 'RenamedSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', PREFIXED_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }
}

/** A node type whose spec never declares a `control_after_generate`. */
class NoControlPack extends LGraphNode {
  constructor() {
    super('NoControlPack')
    this.comfyClass = 'NoControlPack'
    this.serialize_widgets = true
    this.addOutput('INT', 'INT')
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    PackSeed: { widget_order: ['seed', 'control_after_generate'] },
    RenamedSeed: { widget_order: ['seed', 'control_after_generate'] },
    NoControlPack: { widget_order: ['control_after_generate'] }
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
  LiteGraph.registerNodeType('RenamedSeed', RenamedSeed)
  LiteGraph.registerNodeType('NoControlPack', NoControlPack)

  PackSeed.nodeData = fromPartial<
    NonNullable<LGraphNode['constructor']['nodeData']>
  >({ inputs: { seed: transformInputSpecV1ToV2(SEED, { name: 'seed' }) } })
  RenamedSeed.nodeData = fromPartial<
    NonNullable<LGraphNode['constructor']['nodeData']>
  >({
    inputs: { seed: transformInputSpecV1ToV2(PREFIXED_SEED, { name: 'seed' }) }
  })
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

  it('positive control: a control the node kept under another name is still reported', () => {
    const { applyCollected, applyEdit, docWidgets, liveNode } =
      setup('RenamedSeed')
    applyCollected()
    expect(liveNode().widgets?.map((widget) => widget.name)).toEqual([
      'seed',
      'Sampler control_after_generate'
    ])

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    expect(reportError).toHaveBeenCalledWith(
      missingControlReport('RenamedSeed'),
      expect.objectContaining({ errorType: 'agent_graph_widget_missing' })
    )
  })

  it('positive control: a stale entry on a type that never declared the control is still reported', () => {
    const { applyCollected, applyEdit, docWidgets } = setup('NoControlPack')
    applyCollected()

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    expect(reportError).toHaveBeenCalledWith(
      missingControlReport('NoControlPack'),
      expect.objectContaining({ errorType: 'agent_graph_widget_missing' })
    )
  })
})
