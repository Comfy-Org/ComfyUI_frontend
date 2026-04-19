import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  ExportedSubgraphInstance,
  Subgraph
} from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

const DYNAMIC_COMBO_NODE_TYPE = 'test/DynamicComboStringOutput'
const PREVIEW_ANY_NODE_TYPE = 'test/PreviewAny'

class DynamicComboStringOutputNode extends LGraphNode {
  static override title = 'DynamicComboStringOutput'

  constructor() {
    super('DynamicComboStringOutput')
    this.serialize_widgets = true
    this.comfyClass = 'DynamicComboStringOutput'
    this.addOutput('output_text', 'STRING')

    this.addWidget('text', 'prompt', 'test input', () => {})
    const samplingModeWidget = this.addWidget(
      'combo',
      'sampling_mode',
      'on',
      () => {},
      {
        values: ['on', 'off']
      }
    )

    const temperatureWidget = this.addWidget(
      'number',
      'sampling_mode.temperature',
      0.7,
      () => {},
      { min: 0.01, max: 2, step: 0.01 }
    )
    const topKWidget = this.addWidget(
      'number',
      'sampling_mode.top_k',
      64,
      () => {},
      { min: 0, max: 1000, step: 1 }
    )

    temperatureWidget.options ??= {}
    temperatureWidget.options.serialize = false
    topKWidget.options ??= {}
    topKWidget.options.serialize = false

    samplingModeWidget.serializeValue = undefined
  }
}

class PreviewAnyNode extends LGraphNode {
  static override title = 'PreviewAny'

  constructor() {
    super('PreviewAny')
    this.comfyClass = 'PreviewAny'
    this.addInput('source', '*')
  }
}

function buildDynamicComboWorkflow(): {
  graph: LGraph
  dynamicNode: LGraphNode
  previewNode: LGraphNode
} {
  const graph = new LGraph()
  const dynamicNode = LiteGraph.createNode(DYNAMIC_COMBO_NODE_TYPE)
  const previewNode = LiteGraph.createNode(PREVIEW_ANY_NODE_TYPE)

  if (!dynamicNode || !previewNode)
    throw new Error('Failed to create fixture nodes for executionUtil tests')

  graph.add(dynamicNode)
  graph.add(previewNode)

  const samplingModeWidget = dynamicNode.widgets?.find(
    (widget) => widget.name === 'sampling_mode'
  )
  if (!samplingModeWidget)
    throw new Error('Fixture node is missing sampling_mode widget')

  samplingModeWidget.serializeValue = (node) => {
    const widgetsByName = new Map(
      (node.widgets ?? []).map((widget: { name?: string; value?: unknown }) => [
        widget.name,
        widget.value
      ])
    )

    return {
      sampling_mode: String(widgetsByName.get('sampling_mode') ?? 'off'),
      temperature: Number(
        widgetsByName.get('sampling_mode.temperature') ?? 0.7
      ),
      top_k: Number(widgetsByName.get('sampling_mode.top_k') ?? 64)
    }
  }

  dynamicNode.connect(0, previewNode, 0)

  return { graph, dynamicNode, previewNode }
}

function registerSubgraphNodeType(subgraph: Subgraph): void {
  const instanceData: ExportedSubgraphInstance = {
    id: -1,
    type: subgraph.id,
    pos: [0, 0],
    size: [100, 100],
    inputs: [],
    outputs: [],
    flags: {},
    order: 0,
    mode: 0
  }

  const nodeClass = class extends SubgraphNode {
    constructor() {
      super(subgraph.rootGraph, subgraph, instanceData)
    }
  }

  Object.defineProperty(nodeClass, 'title', { value: subgraph.name })
  LiteGraph.registerNodeType(subgraph.id, nodeClass)
}

describe('graphToPrompt DynamicCombo serialization regression', () => {
  beforeAll(() => {
    if (LiteGraph.registered_node_types[DYNAMIC_COMBO_NODE_TYPE]) {
      LiteGraph.unregisterNodeType(DYNAMIC_COMBO_NODE_TYPE)
    }
    if (LiteGraph.registered_node_types[PREVIEW_ANY_NODE_TYPE]) {
      LiteGraph.unregisterNodeType(PREVIEW_ANY_NODE_TYPE)
    }

    LiteGraph.registerNodeType(
      DYNAMIC_COMBO_NODE_TYPE,
      DynamicComboStringOutputNode
    )
    LiteGraph.registerNodeType(PREVIEW_ANY_NODE_TYPE, PreviewAnyNode)
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterAll(() => {
    if (LiteGraph.registered_node_types[DYNAMIC_COMBO_NODE_TYPE]) {
      LiteGraph.unregisterNodeType(DYNAMIC_COMBO_NODE_TYPE)
    }
    if (LiteGraph.registered_node_types[PREVIEW_ANY_NODE_TYPE]) {
      LiteGraph.unregisterNodeType(PREVIEW_ANY_NODE_TYPE)
    }
  })

  it('serializes DynamicCombo widget payload at top level', async () => {
    const { graph, dynamicNode } = buildDynamicComboWorkflow()

    const { output } = await graphToPrompt(graph)
    const dynamicOutput = output[String(dynamicNode.id)]

    expect(dynamicOutput).toBeDefined()
    expect(dynamicOutput.inputs.prompt).toBe('test input')
    expect(dynamicOutput.inputs.sampling_mode).toEqual({
      sampling_mode: 'on',
      temperature: 0.7,
      top_k: 64
    })
  })

  it('serializes DynamicCombo widget payload when node is packed into a subgraph', async () => {
    const { graph, dynamicNode, previewNode } = buildDynamicComboWorkflow()

    const registeredSubgraphTypes: string[] = []
    graph.rootGraph.events.addEventListener('subgraph-created', (event) => {
      const { subgraph } = event.detail
      registerSubgraphNodeType(subgraph)
      registeredSubgraphTypes.push(subgraph.id)
    })

    try {
      graph.convertToSubgraph(new Set([dynamicNode, previewNode]))

      const { output } = await graphToPrompt(graph)
      const dynamicEntries = Object.values(output).filter(
        (node) => node.class_type === 'DynamicComboStringOutput'
      )

      expect(dynamicEntries).toHaveLength(1)
      expect(dynamicEntries[0].inputs.prompt).toBe('test input')
      expect(dynamicEntries[0].inputs.sampling_mode).toEqual({
        sampling_mode: 'on',
        temperature: 0.7,
        top_k: 64
      })
    } finally {
      for (const subgraphType of registeredSubgraphTypes) {
        if (LiteGraph.registered_node_types[subgraphType]) {
          LiteGraph.unregisterNodeType(subgraphType)
        }
      }
    }
  })
})
