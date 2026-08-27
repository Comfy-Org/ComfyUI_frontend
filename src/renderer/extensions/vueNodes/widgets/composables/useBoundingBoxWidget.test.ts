import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'
import type { Bounds } from '@/renderer/core/layout/types'
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
  node.graph = fromPartial({
    rootGraph: { id: GRAPH_ID },
    incrementVersion: () => {}
  })
  return node
}

function construct(node: LGraphNode, component?: string) {
  const widget = useBoundingBoxWidget()(
    node,
    fromPartial({ name: 'bounds', type: 'BOUNDINGBOX', component })
  )
  return { widget, fields: widget.linkedWidgets as NumberWidget[] }
}

const parentId = (node: LGraphNode) => widgetId(GRAPH_ID, node.id, 'bounds')

const storeBounds = (node: LGraphNode) =>
  useWidgetValueStore().getWidget(parentId(node))?.value

describe('useBoundingBoxWidget', () => {
  it('creates the composite widget with four linked field controls', () => {
    const node = makeNode()
    const { widget, fields } = construct(node)

    expect(widget.type).toBe('boundingbox')
    expect(fields.map((w) => w.name)).toEqual(['x', 'y', 'width', 'height'])
  })

  it('creates an imagecrop widget for the ImageCrop component', () => {
    const { widget } = construct(makeNode(), 'ImageCrop')
    expect(widget.type).toBe('imagecrop')
  })

  it('registers only the parent bounds value in the store', () => {
    const node = makeNode()
    construct(node)

    expect(storeBounds(node)).toEqual({ x: 0, y: 0, width: 512, height: 512 })
    const store = useWidgetValueStore()
    for (const field of ['x', 'y', 'width', 'height']) {
      expect(
        store.getWidget(widgetId(GRAPH_ID, node.id, field))
      ).toBeUndefined()
    }
  })

  it('reads field values through the parent bounds', () => {
    const node = makeNode()
    const { fields } = construct(node)

    useWidgetValueStore().setValue(parentId(node), {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    expect(fields.map((w) => w.value)).toEqual([10, 20, 30, 40])
  })

  it('writes a field edit as one rounded atomic bounds replacement', () => {
    const node = makeNode()
    const { fields } = construct(node)
    const before = storeBounds(node)

    fields[0].value = 3.7

    expect(storeBounds(node)).toEqual({ x: 4, y: 0, width: 512, height: 512 })
    expect(storeBounds(node)).not.toBe(before)
  })

  it('clamps edits made through the numeric widget setValue path', () => {
    const node = makeNode()
    const { fields } = construct(node)

    fields[2].setValue(
      999999,
      fromPartial({ node, canvas: { graph_mouse: [0, 0] } })
    )

    expect(storeBounds(node)).toMatchObject({ width: 8192 })
  })

  it('falls back to spec defaults when the stored bounds are malformed', () => {
    const node = makeNode()
    const { fields } = construct(node)

    useWidgetValueStore().setValue(parentId(node), 'legacy-garbage')
    expect(fields.map((w) => w.value)).toEqual([0, 0, 512, 512])

    fields[0].value = 5
    expect(storeBounds(node)).toEqual({ x: 5, y: 0, width: 512, height: 512 })
  })

  it('routes field edits to the parent while the node is detached from a graph', () => {
    nodeCounter += 1
    const node = new LGraphNode('TestNode')
    node.id = toNodeId(nodeCounter)
    const { widget, fields } = construct(node)

    fields[1].value = 12

    expect((widget.value as Bounds).y).toBe(12)
  })
})
