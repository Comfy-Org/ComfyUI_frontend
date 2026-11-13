import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isDOMWidget } from '@/scripts/domWidget'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type {
  CanvasDef,
  CanvasPointerEvent,
  Comfy,
  WidgetCollection
} from '@/platform/nodeApi/v4/types'

describe('canvas widgets', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    stubCanvasGetContext()
    graph = new LGraph()
    ;({ comfy } = createComfyApi({ getGraph: () => graph }))
  })

  function widgets(): { node: LGraphNode; widgets: WidgetCollection } {
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)
    const collection = comfy.graph.node(String(node.id))?.widgets
    assert(collection)
    return { node, widgets: collection }
  }

  function containerOf(node: LGraphNode): HTMLElement {
    const widget = node.widgets?.[0]
    assert(widget && isDOMWidget(widget))
    return widget.element
  }

  function canvasOf(def: Partial<CanvasDef> = {}) {
    const { node, widgets: collection } = widgets()
    const draw = vi.fn<CanvasDef['draw']>()
    const handle = collection.canvas({ name: 'surface', draw, ...def })
    assert(handle)
    const element = containerOf(node).querySelector('canvas')
    assert(element)
    return { node, collection, handle, draw, element }
  }

  it('draws once it is mounted, with the size, the theme and no value', () => {
    const { handle, draw, element } = canvasOf()

    expect(handle.widget.widgetType).toBe('custom')
    expect(draw).toHaveBeenCalledOnce()
    const call = draw.mock.calls[0]
    assert(call)
    const [context, size, theme, value] = call
    expect(context.canvas).toBe(element)
    expect(size).toEqual([0, 0])
    expect(Object.isFrozen(size)).toBe(true)
    expect(theme).toEqual({
      surface: 'transparent',
      surfaceHovered: 'transparent',
      border: 'currentColor',
      text: 'currentColor',
      textSecondary: 'currentColor'
    })
    expect(value).toBeUndefined()
  })

  it('reads the theme’s colors from the page', () => {
    const { handle, draw, element } = canvasOf()
    const colors: Record<string, string> = {
      '--color-input': ' #123456 ',
      '--color-muted-foreground': 'gray'
    }
    const readStyle = vi.spyOn(window, 'getComputedStyle').mockReturnValue(
      fromPartial<CSSStyleDeclaration>({
        getPropertyValue: (token: string) => colors[token] ?? ''
      })
    )

    handle.redraw()

    expect(readStyle).toHaveBeenCalledWith(element)
    expect(draw.mock.calls[1]?.[2]).toMatchObject({
      surface: '#123456',
      textSecondary: 'gray',
      border: 'currentColor'
    })
  })

  it('draws again on redraw, and when the value changes', () => {
    const { handle, draw } = canvasOf({ defaultValue: { level: 1 } })

    handle.redraw()
    handle.widget.setValue({ level: 2 })

    expect(draw).toHaveBeenCalledTimes(3)
    expect(draw.mock.calls[2]?.[3]?.get()).toEqual({ level: 2 })
  })

  it('stops drawing once the widget is removed', () => {
    const { collection, handle, draw } = canvasOf()

    collection.remove('surface')
    handle.redraw()

    expect(draw).toHaveBeenCalledOnce()
  })

  it('reports a draw that throws', () => {
    const { handle, draw } = canvasOf()
    draw.mockImplementation(() => {
      throw new Error('draw failed')
    })

    handle.redraw()

    expect(reportError).toHaveBeenCalledOnce()
  })

  describe('pointer', () => {
    function pointer(type: string, init: PointerEventInit = {}) {
      return new PointerEvent(type, {
        clientX: 15,
        clientY: 25,
        bubbles: true,
        ...init
      })
    }

    it('reports a primary press, a move and a release where draw would put them', () => {
      const received: CanvasPointerEvent[] = []
      const record = (event: CanvasPointerEvent) => received.push(event)
      const { element } = canvasOf({
        onPointerDown: record,
        onPointerMove: record,
        onPointerUp: record
      })
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(10, 20, 0, 0)
      )
      vi.spyOn(element, 'setPointerCapture').mockImplementation(() => {})

      element.dispatchEvent(pointer('pointerdown', { button: 0 }))
      element.dispatchEvent(pointer('pointermove'))
      element.dispatchEvent(pointer('pointerup'))

      expect(received.map(({ x, y, event }) => [event.type, x, y])).toEqual([
        ['pointerdown', 5, 5],
        ['pointermove', 5, 5],
        ['pointerup', 5, 5]
      ])
      expect(Object.isFrozen(received[0])).toBe(true)
    })

    it('scales a position on a zoomed canvas back to the units draw uses', () => {
      const received: CanvasPointerEvent[] = []
      const { element } = canvasOf({
        onPointerMove: (event) => received.push(event)
      })
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(10, 20, 200, 100)
      )
      vi.spyOn(element, 'clientWidth', 'get').mockReturnValue(100)

      element.dispatchEvent(pointer('pointermove'))

      expect([received[0]?.x, received[0]?.y]).toEqual([2.5, 2.5])
    })

    it('keeps a primary press from the node under it, and captures the pointer', () => {
      const { node, element } = canvasOf({ onPointerDown: () => {} })
      const container = containerOf(node)
      const reachedNode = vi.fn()
      container.addEventListener('pointerdown', reachedNode)
      const capture = vi
        .spyOn(element, 'setPointerCapture')
        .mockImplementation(() => {})

      element.dispatchEvent(pointer('pointerdown', { button: 0, pointerId: 3 }))

      expect(reachedNode).not.toHaveBeenCalled()
      expect(capture).toHaveBeenCalledWith(3)
    })

    it('leaves the middle and right buttons to the canvas and the node', () => {
      const onPointerDown = vi.fn()
      const { node, element } = canvasOf({ onPointerDown })
      const reachedNode = vi.fn()
      containerOf(node).addEventListener('pointerdown', reachedNode)

      element.dispatchEvent(pointer('pointerdown', { button: 1 }))
      element.dispatchEvent(pointer('pointerdown', { button: 2 }))

      expect(onPointerDown).not.toHaveBeenCalled()
      expect(reachedNode).toHaveBeenCalledTimes(2)
    })

    it('releases a captured pointer on release', () => {
      const { element } = canvasOf({ onPointerUp: () => {} })
      vi.spyOn(element, 'hasPointerCapture').mockReturnValue(true)
      const release = vi
        .spyOn(element, 'releasePointerCapture')
        .mockImplementation(() => {})

      element.dispatchEvent(pointer('pointerup', { pointerId: 4 }))

      expect(release).toHaveBeenCalledWith(4)
    })

    it('stops reporting once the widget is removed', () => {
      const onPointerMove = vi.fn()
      const { collection, element } = canvasOf({ onPointerMove })

      collection.remove('surface')
      element.dispatchEvent(pointer('pointermove'))

      expect(onPointerMove).not.toHaveBeenCalled()
    })

    it('reports a handler that throws', () => {
      const { element } = canvasOf({
        onPointerMove: () => {
          throw new Error('handler failed')
        }
      })

      element.dispatchEvent(pointer('pointermove'))

      expect(reportError).toHaveBeenCalledOnce()
    })
  })

  it.for([
    ['no draw', { name: 'surface' }],
    [
      'a handler that is not a function',
      { name: 's', draw: () => {}, onPointerUp: 1 }
    ],
    [
      'an unknown field',
      { name: 's', draw: () => {}, onContextMenu: () => {} }
    ],
    [
      'a height that is not a size',
      { name: 's', draw: () => {}, height: Infinity }
    ]
  ] as const)('refuses a definition with %s', ([, def]) => {
    const { node, widgets: collection } = widgets()

    expect(() => Reflect.apply(collection.canvas, collection, [def])).toThrow(
      TypeError
    )
    expect(node.widgets ?? []).toHaveLength(0)
  })

  it('makes nothing on a deleted node', () => {
    const { node, widgets: collection } = widgets()
    const draw = vi.fn()
    graph.remove(node)

    expect(collection.canvas({ name: 'surface', draw })).toBeUndefined()
    expect(draw).not.toHaveBeenCalled()
  })

  it('scales the backing store to the device pixel ratio, and draws in CSS pixels', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(40)

    const { draw, element } = canvasOf()

    expect([element.width, element.height]).toEqual([200, 80])
    expect([element.style.width, element.style.height]).toEqual([
      '100px',
      '40px'
    ])
    expect(draw.mock.calls[0]?.[1]).toEqual([100, 40])
  })

  it('draws at one pixel per CSS pixel where the window reports no ratio', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(0)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(30)

    const { element } = canvasOf()

    expect(element.width).toBe(30)
  })

  it('draws nothing where the browser gives no 2D context', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const { draw } = canvasOf()

    expect(draw).not.toHaveBeenCalled()
  })
})
