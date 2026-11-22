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

/**
 * Declared, and never built: `addInputWidget` returns before the factory. Keeps
 * the positive control below a declared-but-unbuilt gap rather than a name this
 * definition does not carry, which #24052 stops reporting.
 */
const FORCE_INPUT_CFG: InputSpec = ['FLOAT', { default: 8, forceInput: true }]

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
    dropControl(this, 'control_after_generate')
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

const BLANK_SEED: InputSpec = [
  'INT',
  {
    default: 0,
    min: 0,
    max: 2147483647,
    // A blank override and a blank prefix are both "absent" to the real
    // widget factory, which falls back to the bare default name.
    control_after_generate: '   ',
    control_prefix: ''
  }
]

class BlankOverrideSeed extends LGraphNode {
  constructor() {
    super('BlankOverrideSeed')
    this.comfyClass = 'BlankOverrideSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', BLANK_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }

  override onNodeCreated() {
    dropControl(this, 'control_after_generate')
  }
}

/**
 * No `control_after_generate` flag at all. `useIntWidget` falls back to the
 * input's name, so `seed` and `noise_seed` still build a real control — the
 * shape the upstream rgthree and efficiency-nodes definitions actually ship.
 */
const IMPLICIT_SEED: InputSpec = [
  'INT',
  { default: 0, min: 0, max: 2147483647 }
]

const FORCE_INPUT_SEED: InputSpec = [
  'INT',
  { default: 0, forceInput: true, control_after_generate: true }
]

const SUPPRESSED_SEED: InputSpec = [
  'INT',
  { default: 0, control_after_generate: false }
]

function dropControl(node: LGraphNode, name: string) {
  const widgets = node.widgets ?? []
  const index = widgets.findIndex((widget) => widget.name === name)
  expect(index).toBeGreaterThanOrEqual(0)
  widgets.splice(index, 1)
}

/** A flag-free `seed`, exactly as the affected packs declare it. */
class ImplicitSeed extends LGraphNode {
  constructor() {
    super('ImplicitSeed')
    this.comfyClass = 'ImplicitSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', IMPLICIT_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }

  override onNodeCreated() {
    dropControl(this, 'control_after_generate')
  }
}

/** The same implicit fallback under the other recognised name. */
class ImplicitNoiseSeed extends LGraphNode {
  constructor() {
    super('ImplicitNoiseSeed')
    this.comfyClass = 'ImplicitNoiseSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'noise_seed', IMPLICIT_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }

  override onNodeCreated() {
    dropControl(this, 'control_after_generate')
  }
}

/**
 * `forceInput` makes `addInputWidget` return before the factory, so this node
 * never had a control to remove and a named write to it is real drift.
 */
class ForceInputSeed extends LGraphNode {
  constructor() {
    super('ForceInputSeed')
    this.comfyClass = 'ForceInputSeed'
    this.serialize_widgets = true
    this.addInput('seed', 'INT')
    this.addOutput('INT', 'INT')
  }
}

/** An explicit `false` suppresses the control instead of reaching the fallback. */
class SuppressedSeed extends LGraphNode {
  constructor() {
    super('SuppressedSeed')
    this.comfyClass = 'SuppressedSeed'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', SUPPRESSED_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }
}

/**
 * Two declared controls, one dropped and one kept. Distinguishes the
 * per-control rule from a node-wide "has any value control" check.
 */
class MixedControlPack extends LGraphNode {
  constructor() {
    super('MixedControlPack')
    this.comfyClass = 'MixedControlPack'
    this.serialize_widgets = true
    ComfyWidgets.INT(this, 'seed', SEED, fromPartial({}))
    ComfyWidgets.INT(this, 'noise_seed', PREFIXED_SEED, fromPartial({}))
    this.addOutput('INT', 'INT')
  }

  override onNodeCreated() {
    dropControl(this, 'control_after_generate')
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    PackSeed: { widget_order: ['seed', 'control_after_generate'] },
    RenamedSeed: { widget_order: ['seed', 'control_after_generate'] },
    NoControlPack: { widget_order: ['control_after_generate'] },
    BlankOverrideSeed: { widget_order: ['seed', 'control_after_generate'] },
    ImplicitSeed: { widget_order: ['seed', 'control_after_generate'] },
    ImplicitNoiseSeed: {
      widget_order: ['noise_seed', 'control_after_generate']
    },
    ForceInputSeed: { widget_order: ['control_after_generate'] },
    SuppressedSeed: { widget_order: ['seed', 'control_after_generate'] },
    MixedControlPack: {
      widget_order: [
        'seed',
        'control_after_generate',
        'noise_seed',
        'Sampler control_after_generate'
      ]
    }
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

function defineInputs(
  nodeType: typeof LGraphNode,
  specs: Record<string, InputSpec>
) {
  nodeType.nodeData = fromPartial<
    NonNullable<LGraphNode['constructor']['nodeData']>
  >({
    inputs: Object.fromEntries(
      Object.entries(specs).map(([name, spec]) => [
        name,
        transformInputSpecV1ToV2(spec, { name })
      ])
    )
  })
}

beforeEach(() => {
  LiteGraph.registerNodeType('PackSeed', PackSeed)
  LiteGraph.registerNodeType('RenamedSeed', RenamedSeed)
  LiteGraph.registerNodeType('NoControlPack', NoControlPack)
  LiteGraph.registerNodeType('BlankOverrideSeed', BlankOverrideSeed)
  LiteGraph.registerNodeType('ImplicitSeed', ImplicitSeed)
  LiteGraph.registerNodeType('ImplicitNoiseSeed', ImplicitNoiseSeed)
  LiteGraph.registerNodeType('ForceInputSeed', ForceInputSeed)
  LiteGraph.registerNodeType('SuppressedSeed', SuppressedSeed)
  LiteGraph.registerNodeType('MixedControlPack', MixedControlPack)

  defineInputs(ImplicitSeed, { seed: IMPLICIT_SEED })
  defineInputs(ImplicitNoiseSeed, { noise_seed: IMPLICIT_SEED })
  defineInputs(ForceInputSeed, { seed: FORCE_INPUT_SEED })
  defineInputs(SuppressedSeed, { seed: SUPPRESSED_SEED })
  defineInputs(MixedControlPack, {
    seed: SEED,
    noise_seed: PREFIXED_SEED
  })

  defineInputs(PackSeed, { seed: SEED, cfg: FORCE_INPUT_CFG })
  defineInputs(RenamedSeed, { seed: PREFIXED_SEED })
  defineInputs(BlankOverrideSeed, { seed: BLANK_SEED })
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

    const result = applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    // Counting the frame as failed would keep it eligible for retry, which
    // the no-telemetry assertion alone does not catch.
    expect(result.failureCount).toBe(0)
    expect(reportError).not.toHaveBeenCalledWith(
      missingControlReport('PackSeed'),
      expect.anything()
    )
  })

  it.for([
    ['ImplicitSeed', 'seed'],
    ['ImplicitNoiseSeed', 'noise_seed']
  ])(
    'stays quiet for %s, which declares no flag and still builds a control',
    ([type, valueWidget]) => {
      const { applyCollected, applyEdit, docWidgets, liveNode } = setup(type)
      applyCollected()
      expect(liveNode().widgets?.map((widget) => widget.name)).toEqual([
        valueWidget
      ])

      const result = applyEdit(() => {
        docWidgets().set('control_after_generate', 'randomize')
      })

      expect(result.failureCount).toBe(0)
      expect(reportError).not.toHaveBeenCalledWith(
        missingControlReport(type),
        expect.anything()
      )
    }
  )

  it.for([
    { type: 'ForceInputSeed', builtWidgets: [] },
    { type: 'SuppressedSeed', builtWidgets: ['seed'] }
  ])(
    'positive control: $type never built a control, so a named write is drift',
    ({ type, builtWidgets }) => {
      const { applyCollected, applyEdit, docWidgets, liveNode } = setup(type)
      applyCollected()
      expect(liveNode().widgets?.map((widget) => widget.name) ?? []).toEqual(
        builtWidgets
      )

      const result = applyEdit(() => {
        docWidgets().set('control_after_generate', 'randomize')
      })

      expect(result.failureCount).toBe(1)
      expect(reportError).toHaveBeenCalledWith(
        missingControlReport(type),
        expect.objectContaining({ errorType: 'agent_graph_widget_missing' })
      )
    }
  )

  it('is per control: a dropped one is quiet while a retained one is unaffected', () => {
    const { applyCollected, applyEdit, docWidgets, liveNode } =
      setup('MixedControlPack')
    applyCollected()
    // The prefixed control survives; only the bare-named one was dropped.
    expect(liveNode().widgets?.map((widget) => widget.name)).toEqual([
      'seed',
      'noise_seed',
      'Sampler control_after_generate'
    ])

    const quiet = applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    expect(quiet.failureCount).toBe(0)
    expect(reportError).not.toHaveBeenCalledWith(
      missingControlReport('MixedControlPack'),
      expect.anything()
    )

    const applied = applyEdit(() => {
      docWidgets().set('Sampler control_after_generate', 'increment')
    })

    expect(applied.failureCount).toBe(0)
    expect(
      liveNode().widgets?.find(
        (widget) => widget.name === 'Sampler control_after_generate'
      )?.value
    ).toBe('increment')
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

  it('a blank override/prefix still names the bare default control', () => {
    const { applyCollected, applyEdit, docWidgets, liveNode } =
      setup('BlankOverrideSeed')
    applyCollected()
    expect(liveNode().widgets?.map((widget) => widget.name)).toEqual(['seed'])

    applyEdit(() => {
      docWidgets().set('control_after_generate', 'randomize')
    })

    expect(reportError).not.toHaveBeenCalledWith(
      missingControlReport('BlankOverrideSeed'),
      expect.anything()
    )
  })
})
