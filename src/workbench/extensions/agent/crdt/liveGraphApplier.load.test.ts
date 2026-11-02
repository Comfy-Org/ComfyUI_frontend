import type {
  WidgetCatalog,
  WorkflowJSON,
  WorkflowNode
} from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSerialisedNode } from '@/core/graph/loadSerialisedNode'
import { withGraphConfiguring } from '@/core/graph/withGraphConfiguring'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { useApp } from '@/scripts/appInstance'
import {
  PrimitiveNode,
  widgetInputsExtension
} from '@/extensions/core/widgetInputs'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { GET_CONFIG } from '@comfyorg/graph-model/widgets'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

vi.mock(import('@comfyorg/telemetry/reportError'))

class KSampler extends LGraphNode {
  constructor() {
    super('KSampler')
    this.serialize_widgets = true
    this.addWidget('combo', 'sampler_name', 'euler', () => {}, {
      values: ['euler', 'heun']
    })
    this.addWidget('combo', 'control_after_generate', 'fixed', () => {}, {
      values: ['fixed', 'randomize']
    })
    this.addWidget('combo', 'scheduler', 'normal', () => {}, {
      values: ['normal', 'karras']
    })
    this.addInput('model', 'MODEL')
  }
}

const lifecycle: string[] = []

class LifecycleSource extends LGraphNode {
  constructor() {
    super('LifecycleSource')
    this.addOutput('MODEL', 'MODEL')
  }

  override onConfigure() {
    lifecycle.push(`configure configuring=${useApp().configuringGraph}`)
  }

  override onConnectionsChange() {
    lifecycle.push(`connect configuring=${useApp().configuringGraph}`)
  }

  override onGraphConfigured() {
    lifecycle.push('onGraphConfigured')
  }

  override onAfterGraphConfigured() {
    lifecycle.push(
      `onAfterGraphConfigured links=${this.outputs[0].links?.length ?? 0}`
    )
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    KSampler: {
      widget_order: ['sampler_name', 'control_after_generate', 'scheduler']
    },
    LifecycleSource: { widget_order: [] },
    Seeded: { widget_order: ['seed'] },
    PrimitiveNode: { widget_order: ['value'] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function sampler(
  id: number,
  widgets_values: (string | boolean)[]
): ISerialisedNode & WorkflowNode {
  return {
    id,
    type: 'KSampler',
    pos: [id * 300, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: 'model', type: 'MODEL', link: null }],
    widgets_values
  }
}

function applyWorkflow(workflow: WorkflowJSON, graph = new LGraph()) {
  const { doc, collector } = followedDoc(workflow, CATALOG)
  new LiveGraphApplier({ getGraph: () => graph }).applyChanges(
    doc,
    collector.take(),
    CONTEXT
  )
  return graph
}

function liveNode(graph: LGraph, id: number) {
  const node = graph.getNodeById(toNodeId(id))
  assert.exists(node)
  return node
}

beforeEach(() => {
  lifecycle.length = 0
  LiteGraph.registerNodeType('KSampler', KSampler)
  LiteGraph.registerNodeType('LifecycleSource', LifecycleSource)
})

describe('LiveGraphApplier node creation through loadSerialisedNode', () => {
  it.for([
    {
      name: 'legacy sampler prefix and boolean control',
      document: ['sample_heun', true, 'karras'],
      live: ['heun', 'randomize', 'karras']
    },
    {
      name: 'boolean false control',
      document: ['euler', false, 'normal'],
      live: ['euler', 'fixed', 'normal']
    }
  ])('migrates $name like a workflow load', ({ document, live }) => {
    const graph = applyWorkflow({ nodes: [sampler(7, document)], links: [] })

    expect(liveNode(graph, 7).serialize().widgets_values).toEqual(live)
  })

  it('serialises every field of a loaded node identically on an agent-created one', () => {
    const info = sampler(7, ['sample_heun', true, 'karras'])
    const graph = applyWorkflow({ nodes: [info], links: [] })
    const loaded = withGraphConfiguring(() =>
      loadSerialisedNode(new LGraph(), structuredClone(info))
    )

    expect(liveNode(graph, 7).serialize()).toMatchObject(loaded.serialize())
  })

  it('runs the loadedGraphNode extension hook for each created node', () => {
    const loadedGraphNode = vi.fn()
    useExtensionStore().registerExtension({
      name: 'test.loadedGraphNode',
      loadedGraphNode
    })

    const graph = applyWorkflow({ nodes: [sampler(7, [])], links: [] })

    expect(loadedGraphNode).toHaveBeenCalledWith(liveNode(graph, 7), useApp())
  })

  const sourceLinkedToSampler: WorkflowJSON = {
    nodes: [
      {
        id: 3,
        type: 'LifecycleSource',
        pos: [0, 0],
        size: [100, 50],
        outputs: [{ name: 'MODEL', type: 'MODEL', links: [1] }]
      },
      {
        ...sampler(7, []),
        inputs: [{ name: 'model', type: 'MODEL', link: 1 }]
      }
    ],
    links: [[1, 3, 0, 7, 0, 'MODEL']]
  }

  it('configures and connects created nodes while configuring, around the graph-configured callbacks', () => {
    applyWorkflow(sourceLinkedToSampler)

    expect(lifecycle).toEqual([
      'configure configuring=true',
      'onGraphConfigured',
      'connect configuring=true',
      'onAfterGraphConfigured links=1'
    ])
  })

  it('connects a created node to an existing one interactively', () => {
    const graph = new LGraph()
    const source = LiteGraph.createNode('LifecycleSource')
    assert.exists(source)
    source.id = toNodeId(3)
    graph.add(source)

    applyWorkflow(sourceLinkedToSampler, graph)

    expect(lifecycle).toEqual(['connect configuring=false'])
  })
})

const SEEDED_DEF = fromPartial<ComfyNodeDef>({
  input: { required: { seed: ['INT', {}] } }
})

class Seeded extends LGraphNode {
  static override nodeData = SEEDED_DEF

  constructor() {
    super('Seeded')
    this.serialize_widgets = true
    this.addWidget('number', 'seed', 1, () => {})
    this.addInput('seed', 'INT')
    this.inputs[0].widget = {
      name: 'seed',
      [GET_CONFIG]: () => ['INT', {}]
    }
  }
}

describe('LiveGraphApplier PrimitiveNode links to created widget inputs', () => {
  beforeEach(async () => {
    await widgetInputsExtension.beforeRegisterNodeDef?.(
      Seeded,
      SEEDED_DEF,
      useApp()
    )
    LiteGraph.registerNodeType('Seeded', Seeded)
    LiteGraph.registerNodeType('PrimitiveNode', PrimitiveNode)
  })

  function seeded(id: number, link: number) {
    return {
      id,
      type: 'Seeded',
      pos: [id * 300, 0],
      size: [200, 100],
      inputs: [{ name: 'seed', type: 'INT', widget: { name: 'seed' }, link }],
      widgets_values: [1]
    }
  }

  const primitiveFannedOut: WorkflowJSON = {
    nodes: [
      {
        id: 1,
        type: 'PrimitiveNode',
        pos: [0, 0],
        size: [200, 80],
        outputs: [{ name: 'INT', type: 'INT', links: [1, 2] }],
        widgets_values: [5]
      },
      seeded(7, 1),
      seeded(8, 2)
    ],
    links: [
      [1, 1, 0, 7, 0, 'INT'],
      [2, 1, 0, 8, 0, 'INT']
    ]
  }

  it('connects a created primitive to every created widget input', () => {
    const graph = applyWorkflow(primitiveFannedOut)

    expect(liveNode(graph, 8).inputs[0].link).toBe(2)
  })
})
