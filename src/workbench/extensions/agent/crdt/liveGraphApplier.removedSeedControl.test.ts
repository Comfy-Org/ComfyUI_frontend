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
  { ...SEED[1], control_after_generate: true, control_prefix: 'Sampler' }
]
// A blank override and a blank prefix are both "absent" to the real widget
// factory, which falls back to the bare default name.
const BLANK_SEED: InputSpec = [
  'INT',
  { ...SEED[1], control_after_generate: '   ', control_prefix: '' }
]
// No flag at all: `useIntWidget` falls back to the input's name, so `seed` and
// `noise_seed` still build a real control (the rgthree/efficiency shape).
const IMPLICIT_SEED: InputSpec = [
  'INT',
  { default: 0, min: 0, max: 2147483647 }
]
// Declared, and never built: `addInputWidget` returns before the factory.
const FORCE_INPUT_CFG: InputSpec = ['FLOAT', { default: 8, forceInput: true }]
const FORCE_INPUT_SEED: InputSpec = [
  'INT',
  { default: 0, forceInput: true, control_after_generate: true }
]
const SUPPRESSED_SEED: InputSpec = [
  'INT',
  { default: 0, control_after_generate: false }
]

interface PackDef {
  type: string
  /** Built through the real INT factory, in order. */
  built?: Record<string, InputSpec>
  /** Declared in `nodeData.inputs`, which the applier consults. */
  declared?: Record<string, InputSpec>
  /** Remove the bare `control_after_generate` the factory added. */
  dropControl?: boolean
  /** A socket-only input, never a widget. */
  socket?: string
  order: string[]
}

const PACKS: Record<string, PackDef> = {
  PackSeed: {
    type: 'PackSeed',
    built: { seed: SEED },
    declared: { seed: SEED, cfg: FORCE_INPUT_CFG },
    dropControl: true,
    order: ['seed', 'control_after_generate']
  },
  RenamedSeed: {
    type: 'RenamedSeed',
    built: { seed: PREFIXED_SEED },
    declared: { seed: PREFIXED_SEED },
    order: ['seed', 'control_after_generate']
  },
  NoControlPack: { type: 'NoControlPack', order: ['control_after_generate'] },
  BlankOverrideSeed: {
    type: 'BlankOverrideSeed',
    built: { seed: BLANK_SEED },
    declared: { seed: BLANK_SEED },
    dropControl: true,
    order: ['seed', 'control_after_generate']
  },
  ImplicitSeed: {
    type: 'ImplicitSeed',
    built: { seed: IMPLICIT_SEED },
    declared: { seed: IMPLICIT_SEED },
    dropControl: true,
    order: ['seed', 'control_after_generate']
  },
  ImplicitNoiseSeed: {
    type: 'ImplicitNoiseSeed',
    built: { noise_seed: IMPLICIT_SEED },
    declared: { noise_seed: IMPLICIT_SEED },
    dropControl: true,
    order: ['noise_seed', 'control_after_generate']
  },
  // Never had a control to remove: a named write to it is real drift.
  ForceInputSeed: {
    type: 'ForceInputSeed',
    declared: { seed: FORCE_INPUT_SEED },
    socket: 'seed',
    order: ['control_after_generate']
  },
  // An explicit `false` suppresses the control instead of reaching the fallback.
  SuppressedSeed: {
    type: 'SuppressedSeed',
    built: { seed: SUPPRESSED_SEED },
    declared: { seed: SUPPRESSED_SEED },
    order: ['seed', 'control_after_generate']
  },
  // One declared control dropped, one kept: the rule is per control.
  MixedControlPack: {
    type: 'MixedControlPack',
    built: { seed: SEED, noise_seed: PREFIXED_SEED },
    declared: { seed: SEED, noise_seed: PREFIXED_SEED },
    dropControl: true,
    order: [
      'seed',
      'control_after_generate',
      'noise_seed',
      'Sampler control_after_generate'
    ]
  }
}

function dropControl(node: LGraphNode, name: string) {
  const widgets = node.widgets ?? []
  const index = widgets.findIndex((widget) => widget.name === name)
  expect(index).toBeGreaterThanOrEqual(0)
  widgets.splice(index, 1)
}

function registerPack(def: PackDef) {
  class Pack extends LGraphNode {
    constructor() {
      super(def.type)
      this.comfyClass = def.type
      this.serialize_widgets = true
      for (const [name, spec] of Object.entries(def.built ?? {}))
        ComfyWidgets.INT(this, name, spec, fromPartial({}))
      if (def.socket) this.addInput(def.socket, 'INT')
      this.addOutput('INT', 'INT')
    }

    override onNodeCreated() {
      if (def.dropControl) dropControl(this, 'control_after_generate')
    }
  }
  Pack.nodeData = fromPartial<
    NonNullable<LGraphNode['constructor']['nodeData']>
  >({
    inputs: Object.fromEntries(
      Object.entries(def.declared ?? {}).map(([name, spec]) => [
        name,
        transformInputSpecV1ToV2(spec, { name })
      ])
    )
  })
  LiteGraph.registerNodeType(def.type, Pack)
}

const CATALOG: WidgetCatalog = {
  types: Object.fromEntries(
    Object.values(PACKS).map((def) => [def.type, { widget_order: def.order }])
  )
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
  const setWidget = (name: string, value: unknown) =>
    applyEdit(() => {
      const widgets = nodesMap(doc).get('7')?.get('widgets')
      if (!(widgets instanceof Y.Map)) throw new Error('not named storage')
      widgets.set(name, value)
    })
  const liveNode = () => {
    const node = graph.getNodeById(toNodeId(7))
    if (!node) throw new Error('node 7 was not created')
    return node
  }
  const widgetNames = () => liveNode().widgets?.map((w) => w.name) ?? []
  return { applyCollected, setWidget, liveNode, widgetNames }
}

const missing = (type: string, name = 'control_after_generate') =>
  expect.objectContaining({
    message: `Node 7 (${type}) has no widget '${name}'`
  })
const WIDGET_MISSING = expect.objectContaining({
  errorType: 'agent_graph_widget_missing'
})

beforeEach(() => {
  Object.values(PACKS).forEach(registerPack)
})

describe('a seed control the node removed on purpose', () => {
  it('applies the seed and does not report the removed control on catch-up', () => {
    const { applyCollected, liveNode, widgetNames } = setup('PackSeed')

    applyCollected()

    expect(widgetNames()).toEqual(['seed'])
    expect(liveNode().widgets?.[0].value).toBe(5)
    expect(reportError).not.toHaveBeenCalledWith(
      missing('PackSeed'),
      expect.anything()
    )
  })

  it.for([
    ['PackSeed', ['seed']],
    ['ImplicitSeed', ['seed']],
    ['ImplicitNoiseSeed', ['noise_seed']],
    // A blank override/prefix still names the bare default control.
    ['BlankOverrideSeed', ['seed']]
  ] as const)(
    'stays quiet about a later control_after_generate edit on %s',
    ([type, built]) => {
      const { applyCollected, setWidget, widgetNames } = setup(type)
      applyCollected()
      expect(widgetNames()).toEqual(built)

      const result = setWidget('control_after_generate', 'randomize')

      // Counting the frame as failed would keep it eligible for retry, which
      // the no-telemetry assertion alone does not catch.
      expect(result.failureCount).toBe(0)
      expect(reportError).not.toHaveBeenCalledWith(
        missing(type),
        expect.anything()
      )
    }
  )

  it('is per control: a dropped one is quiet while a retained one is unaffected', () => {
    const { applyCollected, setWidget, liveNode, widgetNames } =
      setup('MixedControlPack')
    applyCollected()
    expect(widgetNames()).toEqual([
      'seed',
      'noise_seed',
      'Sampler control_after_generate'
    ])

    expect(setWidget('control_after_generate', 'randomize').failureCount).toBe(
      0
    )
    expect(reportError).not.toHaveBeenCalledWith(
      missing('MixedControlPack'),
      expect.anything()
    )

    expect(
      setWidget('Sampler control_after_generate', 'increment').failureCount
    ).toBe(0)
    expect(
      liveNode().widgets?.find(
        (w) => w.name === 'Sampler control_after_generate'
      )?.value
    ).toBe('increment')
  })

  it.for([
    // Never built a control, so a named write is drift.
    ['ForceInputSeed', []],
    ['SuppressedSeed', ['seed']],
    // Kept the control under another name / never declared one.
    ['RenamedSeed', ['seed', 'Sampler control_after_generate']],
    ['NoControlPack', []]
  ] as const)(
    'positive control: %s still reports a control_after_generate write',
    ([type, built]) => {
      const { applyCollected, setWidget, widgetNames } = setup(type)
      applyCollected()
      expect(widgetNames()).toEqual(built)

      setWidget('control_after_generate', 'randomize')

      expect(reportError).toHaveBeenCalledWith(missing(type), WIDGET_MISSING)
    }
  )

  it('positive control: other widgets the node lacks are still reported', () => {
    const { applyCollected, setWidget } = setup('PackSeed')
    applyCollected()

    setWidget('cfg', 8)

    expect(reportError).toHaveBeenCalledWith(
      missing('PackSeed', 'cfg'),
      WIDGET_MISSING
    )
  })
})
