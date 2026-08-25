import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { useBoundingBoxWidget } from './useBoundingBoxWidget'

const GRAPH_ID = 'bbox-widget-test'

let nodeCounter = 0

function makeNode(): LGraphNode {
  nodeCounter += 1
  const node = new LGraphNode('TestNode')
  node.id = toNodeId(nodeCounter)
  node.graph = fromPartial({ rootGraph: { id: GRAPH_ID } })
  return node
}

function construct(node: LGraphNode, component?: string) {
  return useBoundingBoxWidget()(
    node,
    fromPartial({ name: 'bounds', type: 'BOUNDINGBOX', component })
  )
}

function value(node: LGraphNode, name: string): unknown {
  return useWidgetValueStore().getWidget(widgetId(GRAPH_ID, node.id, name))
    ?.value
}

function setValue(node: LGraphNode, name: string, v: unknown): void {
  useWidgetValueStore().setValue(widgetId(GRAPH_ID, node.id, name), v as never)
}

describe('useBoundingBoxWidget', () => {
  it('creates the composite widget with four linked numeric sub-widgets', () => {
    const node = makeNode()
    const widget = construct(node)

    expect(widget.type).toBe('boundingbox')
    expect(widget.linkedWidgets?.map((w) => w.name)).toEqual([
      'bounds.x',
      'bounds.y',
      'bounds.width',
      'bounds.height'
    ])
    expect(widget.linkedWidgets?.map((w) => w.label)).toEqual([
      'x',
      'y',
      'width',
      'height'
    ])
    expect(value(node, 'bounds')).toEqual({
      x: 0,
      y: 0,
      width: 512,
      height: 512
    })
  })

  it('creates an imagecrop widget for the ImageCrop component', () => {
    const widget = construct(makeNode(), 'ImageCrop')
    expect(widget.type).toBe('imagecrop')
  })

  it('mirrors main bounds updates into the sub-widgets', async () => {
    const node = makeNode()
    construct(node)

    setValue(node, 'bounds', { x: 10, y: 20, width: 30, height: 40 })
    await nextTick()

    expect(value(node, 'bounds.x')).toBe(10)
    expect(value(node, 'bounds.y')).toBe(20)
    expect(value(node, 'bounds.width')).toBe(30)
    expect(value(node, 'bounds.height')).toBe(40)
  })

  it('keeps fractional main bounds intact while sub-widgets mirror them', async () => {
    const node = makeNode()
    construct(node)

    setValue(node, 'bounds', { x: 3.2, y: 0, width: 512, height: 512 })
    await nextTick()
    await nextTick()

    expect(value(node, 'bounds.x')).toBe(3.2)
    expect(value(node, 'bounds')).toEqual({
      x: 3.2,
      y: 0,
      width: 512,
      height: 512
    })
  })

  it('writes a rounded whole-object bounds update when a sub-widget is edited', async () => {
    const node = makeNode()
    construct(node)

    setValue(node, 'bounds.x', 3.7)
    await nextTick()

    expect(value(node, 'bounds')).toEqual({
      x: 4,
      y: 0,
      width: 512,
      height: 512
    })

    await nextTick()
    expect(value(node, 'bounds.x')).toBe(4)
  })

  it('replaces the bounds object identity on sub-widget edits', async () => {
    const node = makeNode()
    construct(node)
    const before = value(node, 'bounds')

    setValue(node, 'bounds.width', 256)
    await nextTick()

    expect(value(node, 'bounds')).not.toBe(before)
    expect(value(node, 'bounds')).toMatchObject({ width: 256 })
  })

  it('snaps a fractional sub-widget entry back when it rounds to the current bounds', async () => {
    const node = makeNode()
    construct(node)

    setValue(node, 'bounds.x', 0.4)
    await nextTick()
    await nextTick()

    expect(value(node, 'bounds.x')).toBe(0)
    expect(value(node, 'bounds')).toMatchObject({ x: 0 })
  })

  it('wires the sync lazily when constructed before the node joins a graph', async () => {
    nodeCounter += 1
    const node = new LGraphNode('TestNode')
    node.id = toNodeId(nodeCounter)
    construct(node)

    node.graph = fromPartial({ rootGraph: { id: GRAPH_ID } })
    const store = useWidgetValueStore()
    for (const [name, v] of [
      ['bounds', { x: 0, y: 0, width: 512, height: 512 }],
      ['bounds.x', 0],
      ['bounds.y', 0],
      ['bounds.width', 512],
      ['bounds.height', 512]
    ] as const) {
      store.registerWidget(widgetId(GRAPH_ID, node.id, name), {
        type: 'number',
        value: v as never,
        options: {}
      })
    }
    node.onAdded?.(fromPartial({}))

    setValue(node, 'bounds', { x: 7, y: 8, width: 9, height: 10 })
    await nextTick()

    expect(value(node, 'bounds.x')).toBe(7)
    expect(value(node, 'bounds.height')).toBe(10)
  })
})
