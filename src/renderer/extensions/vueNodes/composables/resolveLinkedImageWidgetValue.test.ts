import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import {
  getImageWidgetPreviewUrls,
  resolveLinkedImageWidgetValue
} from './resolveLinkedImageWidgetValue'

describe('resolveLinkedImageWidgetValue', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('reads the selected host value without changing the shared interior value', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'image', type: 'COMBO' }]
    })
    const interiorNode = new LGraphNode('LoadImage')
    interiorNode.id = toNodeId(5)
    const interiorInput = interiorNode.addInput('image', 'COMBO')
    interiorInput.widget = { name: 'image' }
    const interiorWidget = interiorNode.addWidget(
      'combo',
      'image',
      'interior.png',
      () => undefined,
      { values: ['interior.png', 'first.png', 'second.png'] }
    )
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorInput, interiorNode)

    const firstHost = createTestSubgraphNode(subgraph, { id: 11 })
    const secondHost = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(firstHost)
    rootGraph.add(secondHost)

    const firstWidgetId = firstHost.inputs[0].widgetId
    const secondWidgetId = secondHost.inputs[0].widgetId
    expect(firstWidgetId).toBeDefined()
    expect(secondWidgetId).toBeDefined()
    if (!firstWidgetId || !secondWidgetId) return

    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.setValue(firstWidgetId, 'first.png')
    widgetValueStore.setValue(secondWidgetId, 'second.png')

    expect(
      resolveLinkedImageWidgetValue(
        rootGraph,
        createNodeExecutionId([12]),
        interiorNode.id,
        interiorInput.name
      )
    ).toEqual({ hostExecutionId: '12', value: 'second.png' })
    expect(interiorWidget.value).toBe('interior.png')
  })

  it('resolves the outermost host through a nested promoted input chain', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'outer_image', type: 'COMBO' }]
    })
    const innerSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'middle_image', type: 'COMBO' }]
    })
    const imageNode = new LGraphNode('LoadImage')
    imageNode.id = toNodeId(42)
    const imageInput = imageNode.addInput('image', 'COMBO')
    imageInput.widget = { name: 'image' }
    imageNode.addWidget('combo', 'image', 'interior.png', () => undefined, {
      values: ['interior.png', 'middle.png', 'outer.png']
    })
    innerSubgraph.add(imageNode)
    innerSubgraph.inputNode.slots[0].connect(imageInput, imageNode)

    const intermediateHost = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph,
      id: 77
    })
    outerSubgraph.add(intermediateHost)
    outerSubgraph.inputNode.slots[0].connect(
      intermediateHost.inputs[0],
      intermediateHost
    )

    const outerHost = createTestSubgraphNode(outerSubgraph, { id: 65 })
    rootGraph.add(outerHost)

    const intermediateWidgetId = intermediateHost.inputs[0].widgetId
    const outerWidgetId = outerHost.inputs[0].widgetId
    expect(intermediateWidgetId).toBeDefined()
    expect(outerWidgetId).toBeDefined()
    if (!intermediateWidgetId || !outerWidgetId) return

    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.setValue(intermediateWidgetId, 'middle.png')
    widgetValueStore.setValue(outerWidgetId, 'outer.png')

    expect(
      resolveLinkedImageWidgetValue(
        rootGraph,
        createNodeExecutionId([65, 77]),
        imageNode.id,
        imageInput.name
      )
    ).toEqual({ hostExecutionId: '65', value: 'outer.png' })
  })

  it('returns no projection for a linked input that does not reach a boundary', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const interiorNode = new LGraphNode('LoadImage')
    interiorNode.id = toNodeId(5)
    interiorNode.addInput('image', 'COMBO')
    subgraph.add(interiorNode)
    const host = createTestSubgraphNode(subgraph, { id: 11 })
    rootGraph.add(host)

    expect(
      resolveLinkedImageWidgetValue(
        rootGraph,
        createNodeExecutionId([11]),
        interiorNode.id,
        'image'
      )
    ).toBeUndefined()
  })

  it('builds display-only preview URLs from annotated image values', () => {
    const [url] = getImageWidgetPreviewUrls('nested/selected.png [output]')
    const parsed = new URL(url, 'http://localhost')

    expect(parsed.pathname).toBe('/api/view')
    expect(parsed.searchParams.get('filename')).toBe('selected.png')
    expect(parsed.searchParams.get('subfolder')).toBe('nested')
    expect(parsed.searchParams.get('type')).toBe('output')
  })
})
