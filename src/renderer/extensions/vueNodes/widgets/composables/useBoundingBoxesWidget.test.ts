import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { BoundingBox } from '@/types/boundingBoxes'
import type { WidgetValue } from '@/types/widgetValue'

import { useBoundingBoxesWidget } from './useBoundingBoxesWidget'

type WidgetNode = Parameters<ReturnType<typeof useBoundingBoxesWidget>>[0]
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
  const addWidget = vi.fn<WidgetNode['addWidget']>(
    (_type, widgetName, value, _callback, options) => {
      widget.name = widgetName
      widget.value = value
      widget.options = typeof options === 'object' ? options : {}
      return widget
    }
  )
  const node = fromPartial<WidgetNode>({})
  node.comfyClass = comfyClass
  node.widgets = [width, height, widget]
  node.addWidget = addWidget
  useBoundingBoxesWidget()(node, {
    type: 'BOUNDING_BOXES',
    name,
    default: boxes()
  })
  return { node, width, height, widget, addWidget }
}

async function apiValue({ node, widget }: ReturnType<typeof createNode>) {
  return widget.serializeValue
    ? await widget.serializeValue(node, 2)
    : widget.value
}

describe('bounding-box widget defaults', () => {
  it('seeds independent widget values from the spec default', () => {
    const { node, widget } = createNode()
    const shared = boxes()
    useBoundingBoxesWidget()(node, {
      type: 'BOUNDING_BOXES',
      name: 'editor_state',
      default: shared
    })

    expect(widget.value).toEqual(shared)
    expect(widget.value).not.toBe(shared)
    shared[0].metadata.palette.push('#000')
    expect(widget.value).toMatchObject([{ metadata: { palette: ['#fff'] } }])
    expect(widget.options).toEqual({ serialize: true, hideInPanel: true })
  })

  it('defaults to an empty box list', () => {
    const { node, widget } = createNode()
    useBoundingBoxesWidget()(node, {
      type: 'BOUNDING_BOXES',
      name: 'editor_state'
    })

    expect(widget.value).toEqual([])
  })
})

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
