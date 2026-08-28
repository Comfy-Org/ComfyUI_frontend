import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  readImageWidgetValue,
  writeImageWidgetValue
} from './imageWidgetAdapter'

const GRAPH_ID = 'image-widget-adapter-test'

let nodeCounter = 0

function makeNode({
  registered = true,
  widgetValue = 'original.png [input]',
  hasWidget = true
} = {}): LGraphNode {
  nodeCounter += 1
  const nodeId = toNodeId(nodeCounter)
  if (registered) {
    useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, nodeId, 'image'), {
      type: 'string',
      value: widgetValue,
      options: {}
    })
  }
  return fromAny<LGraphNode, unknown>({
    id: nodeId,
    graph: { rootGraph: { id: GRAPH_ID } },
    widgets: hasWidget ? [{ name: 'image', value: widgetValue }] : [],
    properties: {}
  })
}

function storedValue(node: LGraphNode): unknown {
  return useWidgetValueStore().getWidget(widgetId(GRAPH_ID, node.id, 'image'))
    ?.value
}

describe('readImageWidgetValue', () => {
  it('reads the store value for a registered widget', () => {
    const node = makeNode()
    useWidgetValueStore().setValue(
      widgetId(GRAPH_ID, node.id, 'image'),
      'updated.png [input]'
    )

    expect(readImageWidgetValue(node)).toBe('updated.png [input]')
  })

  it('preserves a null store value instead of falling back', () => {
    const node = makeNode()
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, node.id, 'image'), null)

    expect(readImageWidgetValue(node)).toBeNull()
  })

  it('falls back to the widget object when the store has no entry', () => {
    const node = makeNode({ registered: false, widgetValue: 'legacy.png' })

    expect(readImageWidgetValue(node)).toBe('legacy.png')
  })

  it('returns undefined when the widget exists nowhere', () => {
    const node = makeNode({ registered: false, hasWidget: false })

    expect(readImageWidgetValue(node)).toBeUndefined()
  })
})

describe('writeImageWidgetValue', () => {
  it('writes the store value and mirrors it into properties.image', () => {
    const node = makeNode()

    writeImageWidgetValue(node, 'masked.png [input]')

    expect(storedValue(node)).toBe('masked.png [input]')
    expect(node.properties['image']).toBe('masked.png [input]')
  })

  it('falls back to the widget object when the store has no entry', () => {
    const node = makeNode({ registered: false })

    writeImageWidgetValue(node, 'masked.png [input]')

    expect(node.widgets?.[0].value).toBe('masked.png [input]')
    expect(node.properties['image']).toBe('masked.png [input]')
  })

  it('leaves properties untouched when the widget exists nowhere', () => {
    const node = makeNode({ registered: false, hasWidget: false })

    writeImageWidgetValue(node, 'masked.png [input]')

    expect(node.properties['image']).toBeUndefined()
  })
})
