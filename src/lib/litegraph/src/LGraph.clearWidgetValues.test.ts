import { beforeEach, describe, expect, test } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const samplers = ['euler', 'dpmpp_2m']

function samplerNodeType(title: string) {
  return class extends LGraphNode {
    constructor() {
      super(title)
      this.addWidget('combo', 'sampler_name', 'euler', null, {
        values: samplers
      })
    }
  }
}

describe('LGraph.clear', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType('test/Sampler', samplerNodeType('Sampler'))
    LiteGraph.registerNodeType(
      'test/SamplerSelect',
      samplerNodeType('SamplerSelect')
    )
  })

  function addNode(graph: LGraph, type: string) {
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    return node
  }

  test('a node reusing a cleared node id does not inherit its widget value (#20648)', () => {
    const graph = new LGraph()
    const sampler = addNode(graph, 'test/Sampler')
    sampler.widgets![0].value = 'dpmpp_2m'
    const staleKey = widgetId(graph.id, sampler.id, 'sampler_name')
    const store = useWidgetValueStore()
    expect(store.getWidget(staleKey)?.value).toBe('dpmpp_2m')

    graph.clear()
    expect(store.getWidget(staleKey)).toBeUndefined()

    const select = addNode(graph, 'test/SamplerSelect')
    expect(select.id).toBe(sampler.id)
    expect(select.widgets![0].value).toBe('euler')
  })
})
