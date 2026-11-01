import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

import { createBoundingBoxesExtension } from './createBoundingBoxes'

interface MockWidget {
  name: string
  hidden: boolean
  options: Record<string, unknown>
  widgetId?: string
}

function makeNode(comfyClass = 'CreateBoundingBoxes') {
  const widgets: MockWidget[] = [
    { name: 'width', hidden: false, options: {} },
    { name: 'last_incoming', hidden: false, options: {} }
  ]
  return {
    constructor: { comfyClass },
    size: [100, 100] as [number, number],
    setSize: vi.fn(),
    widgets
  }
}

const hiddenOf = (node: ReturnType<typeof makeNode>, name: string) =>
  node.widgets.find((w) => w.name === name)!.hidden

describe('Comfy.CreateBoundingBoxes extension', () => {
  it('ignores nodes of other classes', () => {
    const node = makeNode('SomethingElse')
    createBoundingBoxesExtension.nodeCreated?.(fromAny(node), fromAny({}))
    expect(node.setSize).not.toHaveBeenCalled()
    expect(hiddenOf(node, 'last_incoming')).toBe(false)
  })

  it('enlarges the node and hides only the internal last_incoming widget', () => {
    const node = makeNode()
    createBoundingBoxesExtension.nodeCreated?.(fromAny(node), fromAny({}))
    expect(node.setSize).toHaveBeenCalledWith([420, 560])
    expect(hiddenOf(node, 'width')).toBe(false)
    expect(hiddenOf(node, 'last_incoming')).toBe(true)
  })
})

type WidgetNode = Parameters<
  NonNullable<typeof createBoundingBoxesExtension.nodeCreated>
>[0]
type ExtensionApp = Parameters<
  NonNullable<typeof createBoundingBoxesExtension.nodeCreated>
>[1]
type NodeWidget = NonNullable<WidgetNode['widgets']>[number]

function boxes(): BoundingBox[] {
  return [
    {
      x: 512,
      y: 256,
      width: 256,
      height: 512,
      metadata: { type: 'obj', text: 'subject', desc: '', palette: ['#fff'] }
    }
  ]
}

function createNode(comfyClass = 'CreateBoundingBoxes', name = 'editor_state') {
  const width = fromPartial<NodeWidget>({ name: 'width', value: 1024 })
  const height = fromPartial<NodeWidget>({ name: 'height', value: 1024 })
  const widget = fromPartial<NodeWidget>({ type: 'boundingboxes' })
  const node = fromPartial<WidgetNode>({})
  node.size = [420, 560]
  node.setSize = vi.fn<WidgetNode['setSize']>()
  node.constructor = fromPartial<WidgetNode['constructor']>({ comfyClass })
  widget.name = name
  widget.value = boxes()
  node.widgets = [width, height, widget]
  createBoundingBoxesExtension.nodeCreated?.(
    node,
    fromPartial<ExtensionApp>({})
  )
  return { node, width, height, widget }
}

async function apiValue({ node, widget }: ReturnType<typeof createNode>) {
  return widget.serializeValue
    ? await widget.serializeValue(node, 2)
    : widget.value
}

describe('editor API coordinate basis', () => {
  it('copies metadata and reads current canvas dimensions on each queue', async () => {
    const fixture = createNode()
    const first = await apiValue(fixture)
    fixture.width.value = 768
    fixture.height.value = 1368
    const second = await apiValue(fixture)

    expect(first).toEqual([
      {
        ...boxes()[0],
        metadata: {
          ...boxes()[0].metadata,
          _canvas_size: { width: 1024, height: 1024 }
        }
      }
    ])
    expect(second).toMatchObject([
      { metadata: { _canvas_size: { width: 768, height: 1368 } } }
    ])
    expect(fixture.widget.value).toEqual(boxes())
    expect(first).not.toBe(second)
  })

  it.for<WidgetValue>([
    undefined,
    null,
    true,
    '1024',
    0,
    -1,
    0.5,
    NaN,
    Infinity
  ])(
    'keeps legacy pixel payloads when a canvas dimension is %j',
    async (dimension) => {
      const fixture = createNode()
      fixture.width.value = dimension

      expect(await apiValue(fixture)).toEqual(boxes())
    }
  )

  it('keeps legacy pixels when the height widget is missing', async () => {
    const fixture = createNode()
    fixture.node.widgets = [fixture.width, fixture.widget]

    expect(await apiValue(fixture)).toEqual(boxes())
  })
})

describe('legacy editor values', () => {
  it.for([null, {}, [null, 7]])(
    'preserves invalid box records: %j',
    async (value) => {
      const fixture = createNode()
      fixture.widget.value = value

      expect(await apiValue(fixture)).toEqual(value)
      expect(fixture.widget.value).toEqual(value)
    }
  )
})

describe('other bounding-box widget contracts', () => {
  it.for([
    ['CustomBoundingBoxes', 'editor_state'],
    ['CreateBoundingBoxes', 'last_incoming']
  ])('keeps %s/%s unchanged', async ([comfyClass, name]) => {
    const fixture = createNode(comfyClass, name)

    expect(fixture.widget.serializeValue).toBeUndefined()
    expect(await apiValue(fixture)).toEqual(boxes())
  })
})
