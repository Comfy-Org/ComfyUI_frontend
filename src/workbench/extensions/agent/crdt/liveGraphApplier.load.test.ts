import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSerialisedNode } from '@/core/graph/loadSerialisedNode'
import { withGraphConfiguring } from '@/core/graph/withGraphConfiguring'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { useApp } from '@/scripts/appInstance'
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
    LifecycleSource: { widget_order: [] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function sampler(id: number, widgets_values: unknown[]) {
  return {
    id,
    type: 'KSampler',
    pos: [id * 300, 0],
    size: [200, 100],
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
      loadSerialisedNode(new LGraph(), structuredClone(info) as ISerialisedNode)
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

  it('connects created nodes while configuring, then fires the graph-configured callbacks', () => {
    applyWorkflow(sourceLinkedToSampler)

    expect(lifecycle).toEqual([
      'connect configuring=true',
      'onGraphConfigured',
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
