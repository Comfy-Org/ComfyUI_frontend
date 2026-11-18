import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { apiOnTestCanvas } from '@/platform/nodeApi/v4/events/__tests__/testCanvasSource'
import type {
  GraphOverlayDef,
  GraphOverlayPointerEvent,
  UiHandle
} from '@/platform/nodeApi/v4/types'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

const SCREEN = { x: 100, y: 50, width: 400, height: 200 }

function graphView() {
  stubCanvasGetContext()
  const view = document.createElement('div')
  const element = document.createElement('canvas')
  element.width = SCREEN.width
  element.height = SCREEN.height
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect(SCREEN)
  )
  view.append(element)
  document.body.append(view)
  onTestFinished(() => view.remove())
  const canvas = new LGraphCanvas(element, new LGraph(), { skip_render: true })
  return { view, canvas }
}

function appShowingGraph() {
  const { view, canvas } = graphView()
  const api = apiOnTestCanvas(canvas.graph)
  api.useCanvas(canvas)
  return { view, canvas, ui: api.comfy.ui, useCanvas: api.useCanvas }
}

function overlay(overrides: Partial<GraphOverlayDef> = {}): GraphOverlayDef {
  return { id: 'MyPack.notes', ariaLabel: 'Notes', draw: vi.fn(), ...overrides }
}

function mount(ui: UiHandle, definition: GraphOverlayDef) {
  const handle = ui.mountGraphOverlay(definition)
  onTestFinished(() => handle.remove())
  return handle
}

function overlayElement(view: HTMLElement, id = 'MyPack.notes') {
  const found = view.querySelector<HTMLCanvasElement>(
    `[data-graph-overlay="${id}"]`
  )
  assert(found, `no overlay ${id}`)
  return found
}

function mountToolsPanel(ui: UiHandle, view: HTMLElement): HTMLElement {
  ui.mountViewportPanel({
    id: 'MyPack.tools',
    ariaLabel: 'Tools',
    render: (container) => container.append(document.createElement('button'))
  })
  const button = view.querySelector<HTMLElement>('[data-viewport-panel] button')
  assert(button, 'the tools panel has no button')
  return button
}

function press(
  target: EventTarget,
  type: string,
  init: PointerEventInit = {}
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: SCREEN.x + 30,
    clientY: SCREEN.y + 40,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

function heardByGraph(canvas: LGraphCanvas) {
  const heard = vi.fn()
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    canvas.canvas.addEventListener(type, heard, true)
  }
  return heard
}

describe('mounting a graph overlay', () => {
  it('puts a named canvas over the graph view that lets the pointer through', () => {
    const { view, canvas, ui } = appShowingGraph()

    mount(ui, overlay())

    const element = overlayElement(view)
    expect(element.parentElement).toBe(view)
    expect(element.getAttribute('aria-label')).toBe('Notes')
    expect(element.getAttribute('tabindex')).toBe('-1')
    expect(element.style.pointerEvents).toBe('none')
    expect(element.hidden).toBe(false)
    expect(view.lastElementChild).toBe(element)
    expect(canvas.canvas.compareDocumentPosition(element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('draws on a cleared canvas sized as the graph, in viewport pixels, at the next frame', () => {
    const { view, canvas, ui } = appShowingGraph()
    canvas.dpr = 2
    canvas.ds.scale = 1.5
    const draw = vi.fn<GraphOverlayDef['draw']>()

    mount(ui, overlay({ draw }))
    expect(draw).not.toHaveBeenCalled()
    canvas.draw(true, true)

    expect(draw).toHaveBeenCalledOnce()
    const [context, size, viewport] = draw.mock.calls[0]
    const element = overlayElement(view)
    expect([element.width, element.height]).toEqual([400, 200])
    expect(size).toEqual([200, 100])
    expect(Object.isFrozen(size)).toBe(true)
    expect(viewport.scale).toBe(1.5)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 400, 200)
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('draws once mounted at the next frame, though the graph draws nothing then', () => {
    const { canvas, ui } = appShowingGraph()
    canvas.draw(true, true)
    const draw = vi.fn()

    mount(ui, overlay({ draw }))
    canvas.draw(false, false)

    expect(draw).toHaveBeenCalledOnce()
  })

  it('draws again after each frame the graph draws, and not on a frame it skips', () => {
    const { canvas, ui } = appShowingGraph()
    const draw = vi.fn()
    mount(ui, overlay({ draw }))

    canvas.draw(true, true)
    canvas.draw(true, true)
    canvas.draw(false, false)

    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('keeps the draw the canvas already had, and gives it back when the last overlay leaves', () => {
    const { canvas, ui } = appShowingGraph()
    const hostDraw = vi.fn()
    canvas.onDrawForeground = hostDraw
    const first = mount(ui, overlay({ id: 'MyPack.a' }))
    const second = mount(ui, overlay({ id: 'MyPack.b' }))

    canvas.draw(true, true)
    first.remove()
    expect(canvas.onDrawForeground).not.toBe(hostDraw)
    second.remove()

    expect(hostDraw).toHaveBeenCalledOnce()
    expect(canvas.onDrawForeground).toBe(hostDraw)
  })

  it('draws once a frame after the host chained onto its draw and the overlay was mounted again', () => {
    const { canvas, ui } = appShowingGraph()
    const first = mount(ui, overlay({ id: 'MyPack.a' }))
    const chained = canvas.onDrawForeground
    const hostDraw = vi.fn()
    canvas.onDrawForeground = (context, area) => {
      chained?.call(canvas, context, area)
      hostDraw()
    }
    const draw = vi.fn()

    first.remove()
    mount(ui, overlay({ id: 'MyPack.b', draw }))
    canvas.draw(true, true)

    expect(draw).toHaveBeenCalledOnce()
    expect(hostDraw).toHaveBeenCalledOnce()
  })

  it('redraws once at the next frame however often it is asked', () => {
    const { canvas, ui } = appShowingGraph()
    const draw = vi.fn()
    const handle = mount(ui, overlay({ draw }))
    canvas.draw(true, true)

    handle.redraw()
    handle.redraw()
    expect(draw).toHaveBeenCalledOnce()
    canvas.draw(false, false)
    canvas.draw(false, false)

    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('places a graph point on the overlay as the view now shows it', () => {
    const { canvas, ui } = appShowingGraph()
    canvas.ds.scale = 2
    canvas.ds.offset[0] = 10
    canvas.ds.offset[1] = -5
    let placed: unknown
    mount(
      ui,
      overlay({
        draw: (_context, _size, viewport) => {
          placed = viewport.graphToViewport({ x: 1, y: 2 })
        }
      })
    )

    canvas.draw(true, true)

    expect(placed).toEqual({ x: 22, y: -6 })
    expect(Object.isFrozen(placed)).toBe(true)
  })

  it('refuses a point it cannot place', () => {
    const { canvas, ui } = appShowingGraph()
    let refusal: unknown
    mount(
      ui,
      overlay({
        draw: (_context, _size, viewport) => {
          try {
            Reflect.apply(viewport.graphToViewport, viewport, [
              { x: NaN, y: 0 }
            ])
          } catch (error) {
            refusal = error
          }
        }
      })
    )

    canvas.draw(true, true)

    expect(refusal).toEqual(
      new TypeError('graphToViewport needs x as a finite number, not NaN.')
    )
  })

  it('reports a draw that throws, and the graph keeps drawing', () => {
    const { canvas, ui } = appShowingGraph()
    const broken = new Error('pack draw failed')
    const later = vi.fn()
    mount(
      ui,
      overlay({
        draw: () => {
          throw broken
        }
      })
    )
    mount(ui, overlay({ id: 'MyPack.later', draw: later }))

    canvas.draw(true, true)

    expect(later).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.mountGraphOverlay' } })
    )
  })

  it('skips the draw when its canvas gives no 2D context, and the graph keeps drawing', () => {
    const { view, canvas, ui } = appShowingGraph()
    const draw = vi.fn()
    const later = vi.fn()
    mount(ui, overlay({ draw }))
    mount(ui, overlay({ id: 'MyPack.later', draw: later }))
    Object.defineProperty(overlayElement(view), 'getContext', {
      value: () => null
    })

    canvas.draw(true, true)

    expect(draw).not.toHaveBeenCalled()
    expect(later).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a draw that throws at a frame it asked for, and the frame goes on', () => {
    const { canvas, ui } = appShowingGraph()
    const handle = mount(
      ui,
      overlay({
        draw: () => {
          throw new Error('pack draw failed')
        }
      })
    )
    canvas.draw(true, true)

    handle.redraw()

    expect(() => canvas.draw(false, false)).not.toThrow()
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('waits for a graph view, then mounts and draws on it', () => {
    const { view, canvas } = graphView()
    const api = apiOnTestCanvas(canvas.graph)
    const draw = vi.fn()

    const handle = mount(api.comfy.ui, overlay({ draw }))
    handle.setHitRegions([])
    expect(view.querySelector('[data-graph-overlay]')).toBeNull()
    api.useCanvas(canvas)
    canvas.draw(true, true)

    expect(overlayElement(view).parentElement).toBe(view)
    expect(draw).toHaveBeenCalledOnce()
  })

  it('moves to the graph view the app shows next', () => {
    const { view, canvas, ui, useCanvas } = appShowingGraph()
    const before = canvas.onDrawForeground
    mount(ui, overlay())
    const next = graphView()

    useCanvas(next.canvas)
    next.canvas.draw(true, true)

    expect(canvas.onDrawForeground).toBe(before)
    expect(view.querySelector('[data-graph-overlay]')).toBeNull()
    expect(overlayElement(next.view).parentElement).toBe(next.view)
  })
})

describe('showing and hiding an overlay', () => {
  it('neither shows nor draws a hidden overlay until it is shown', () => {
    const { view, canvas, ui } = appShowingGraph()
    const draw = vi.fn()
    const handle = mount(ui, overlay({ visible: false, draw }))

    canvas.draw(true, true)
    handle.redraw()
    canvas.draw(false, false)
    expect(overlayElement(view).hidden).toBe(true)
    expect(draw).not.toHaveBeenCalled()
    handle.setVisible(true)
    canvas.draw(false, false)

    expect(overlayElement(view).hidden).toBe(false)
    expect(draw).toHaveBeenCalledOnce()
  })
})

describe('taking the pointer', () => {
  it('lets every press through while the overlay is not interactive', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerDown = vi.fn()
    mount(ui, overlay({ onPointerDown }))
    const graph = heardByGraph(canvas)

    press(canvas.canvas, 'pointerdown')

    expect(onPointerDown).not.toHaveBeenCalled()
    expect(graph).toHaveBeenCalledOnce()
  })

  it('takes a press, then that pointer until it is released, from the graph', () => {
    const { canvas, ui } = appShowingGraph()
    const events: [string, GraphOverlayPointerEvent][] = []
    const record = (name: string) => (event: GraphOverlayPointerEvent) =>
      events.push([name, event])
    mount(
      ui,
      overlay({
        interactive: true,
        onPointerDown: record('down'),
        onPointerMove: record('move'),
        onPointerUp: record('up')
      })
    )
    const graph = heardByGraph(canvas)

    const down = press(canvas.canvas, 'pointerdown')
    press(canvas.canvas, 'pointermove', { pointerId: 2 })
    press(canvas.canvas, 'pointermove', { clientX: SCREEN.x + 50 })
    press(document.body, 'pointerup')
    press(canvas.canvas, 'pointermove')

    expect(down.defaultPrevented).toBe(true)
    expect(events.map(([name]) => name)).toEqual(['down', 'move', 'up'])
    expect(graph).toHaveBeenCalledTimes(2)
    expect(events[1][1].viewport).toEqual({ x: 50, y: 40 })
  })

  it('tells the pack where the press is on the overlay and in the graph', () => {
    const { canvas, ui } = appShowingGraph()
    canvas.ds.scale = 2
    canvas.ds.offset[0] = 5
    const onPointerDown = vi.fn()
    mount(ui, overlay({ interactive: true, onPointerDown }))

    press(canvas.canvas, 'pointerdown', {
      pointerId: 7,
      pointerType: 'pen',
      button: 1
    })

    const event = onPointerDown.mock.lastCall?.[0]
    expect(event).toEqual({
      pointerId: 7,
      pointerType: 'pen',
      button: 1,
      viewport: { x: 30, y: 40 },
      graph: { x: 10, y: 20 }
    })
    expect(
      [event, event.viewport, event.graph].every((part) =>
        Object.isFrozen(part)
      )
    ).toBe(true)
  })

  it('takes only presses in its hit regions, and none with no regions', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerDown = vi.fn()
    const handle = mount(ui, overlay({ interactive: true, onPointerDown }))
    const graph = heardByGraph(canvas)
    handle.setHitRegions([
      { kind: 'circle', x: 30, y: 40, radius: 5 },
      { kind: 'rect', x: 100, y: 100, width: 20, height: 10 }
    ])

    const at = (x: number, y: number) =>
      press(canvas.canvas, 'pointerdown', {
        clientX: SCREEN.x + x,
        clientY: SCREEN.y + y
      })
    const pressAndRelease = (x: number, y: number) => {
      at(x, y)
      press(document.body, 'pointerup')
    }
    pressAndRelease(34, 43)
    pressAndRelease(35, 44)
    pressAndRelease(120, 110)
    pressAndRelease(121, 110)
    pressAndRelease(100, 111)
    pressAndRelease(100, 100)
    pressAndRelease(110, 99)
    handle.setHitRegions([])
    pressAndRelease(30, 40)

    expect(
      onPointerDown.mock.calls.map(([event]) => [
        event.viewport.x,
        event.viewport.y
      ])
    ).toEqual([
      [34, 43],
      [120, 110],
      [100, 100]
    ])
    expect(graph).toHaveBeenCalledTimes(5)
  })

  it('follows each of several pointers it took until that one is released', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerMove = vi.fn()
    mount(ui, overlay({ interactive: true, onPointerMove }))

    press(canvas.canvas, 'pointerdown', { pointerId: 1 })
    press(canvas.canvas, 'pointerdown', { pointerId: 2 })
    press(document.body, 'pointerup', { pointerId: 1 })
    press(canvas.canvas, 'pointermove', { pointerId: 1 })
    press(canvas.canvas, 'pointermove', { pointerId: 2 })

    expect(onPointerMove.mock.calls.map(([event]) => event.pointerId)).toEqual([
      2
    ])
  })

  it('keeps a pointer it took when it stops being interactive or loses its regions', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerCancel = vi.fn()
    const onPointerMove = vi.fn()
    const handle = mount(
      ui,
      overlay({ interactive: true, onPointerMove, onPointerCancel })
    )

    press(canvas.canvas, 'pointerdown')
    handle.setInteractive(false)
    handle.setHitRegions([])
    press(canvas.canvas, 'pointermove')
    press(canvas.canvas, 'pointercancel')
    press(canvas.canvas, 'pointermove')
    press(canvas.canvas, 'pointerdown')

    expect(onPointerMove).toHaveBeenCalledOnce()
    expect(onPointerCancel).toHaveBeenCalledOnce()
  })

  it('leaves a press on a panel above it to the panel', () => {
    const { view, canvas, ui } = appShowingGraph()
    const onPointerDown = vi.fn()
    mount(ui, overlay({ interactive: true, onPointerDown }))
    const button = mountToolsPanel(ui, view)
    const clicked = vi.fn()
    button.addEventListener('pointerdown', clicked)
    canvas.draw(true, true)

    press(button, 'pointerdown')
    press(canvas.canvas, 'pointerdown')

    expect(clicked).toHaveBeenCalledOnce()
    expect(onPointerDown).toHaveBeenCalledOnce()
  })

  it('stays below a panel mounted before the overlay first drew, and leaves a press on that panel to it', () => {
    const { view, canvas } = graphView()
    const api = apiOnTestCanvas(canvas.graph)
    const onPointerDown = vi.fn()
    mount(api.comfy.ui, overlay({ interactive: true, onPointerDown }))
    api.useCanvas(canvas)
    const button = mountToolsPanel(api.comfy.ui, view)
    canvas.draw(true, true)

    press(button, 'pointerdown')
    expect(onPointerDown).not.toHaveBeenCalled()
    press(canvas.canvas, 'pointerdown')

    expect(onPointerDown).toHaveBeenCalledOnce()
    expect(overlayElement(view).nextElementSibling).toBe(
      view.querySelector('[data-viewport-panel]')
    )
  })

  it('stays below a panel mounted after it at import, once the graph view comes', () => {
    const { view, canvas } = graphView()
    const api = apiOnTestCanvas(canvas.graph)
    const onPointerDown = vi.fn()
    mount(api.comfy.ui, overlay({ interactive: true, onPointerDown }))
    api.comfy.ui.mountViewportPanel({
      id: 'MyPack.tools',
      ariaLabel: 'Tools',
      render: (container) => container.append(document.createElement('button'))
    })

    api.useCanvas(canvas)
    canvas.draw(true, true)

    const button = view.querySelector('[data-viewport-panel] button')
    assert(button)
    press(button, 'pointerdown')
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(overlayElement(view).nextElementSibling).toBe(button.parentElement)
  })

  it('stays below a panel already shown when it is mounted, and above the graph', () => {
    const { view, canvas, ui } = appShowingGraph()
    mountToolsPanel(ui, view)

    mount(ui, overlay())

    const element = overlayElement(view)
    expect(element.previousElementSibling).toBe(canvas.canvas)
    expect(element.nextElementSibling).toBe(
      view.querySelector('[data-viewport-panel]')
    )
  })

  it('stops listening on the window once it holds no pointer', () => {
    const { canvas, ui } = appShowingGraph()
    mount(ui, overlay({ interactive: true }))
    const stopped = vi.spyOn(window, 'removeEventListener')

    press(canvas.canvas, 'pointerdown')
    press(document.body, 'pointerup')

    expect(stopped.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel'])
    )
  })

  it('takes no press while hidden', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerDown = vi.fn()
    mount(ui, overlay({ interactive: true, visible: false, onPointerDown }))

    press(canvas.canvas, 'pointerdown')

    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('reports a pointer callback that throws, and still keeps the pointer from the graph', () => {
    const { canvas, ui } = appShowingGraph()
    const broken = new Error('pack press failed')
    mount(
      ui,
      overlay({
        interactive: true,
        onPointerDown: () => {
          throw broken
        }
      })
    )
    const graph = heardByGraph(canvas)

    press(canvas.canvas, 'pointerdown')

    expect(graph).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.mountGraphOverlay' } })
    )
  })
})

describe('taking keys', () => {
  function keyDown(target: EventTarget, init: KeyboardEventInit) {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    )
  }

  function heardByApp() {
    const heard = vi.fn()
    window.addEventListener('keydown', heard)
    onTestFinished(() => window.removeEventListener('keydown', heard))
    return heard
  }

  it('takes focus with a press, and gives the pack its keys before the app', () => {
    const { view, canvas, ui } = appShowingGraph()
    const onKeyDown = vi.fn()
    mount(ui, overlay({ interactive: true, onKeyDown }))
    const app = heardByApp()

    press(canvas.canvas, 'pointerdown')
    const element = overlayElement(view)
    expect(document.activeElement).toBe(element)
    keyDown(element, {
      key: 'z',
      ctrlKey: false,
      shiftKey: true,
      metaKey: true,
      repeat: true
    })

    expect(onKeyDown).toHaveBeenCalledExactlyOnceWith({
      key: 'z',
      repeat: true,
      ctrlKey: false,
      metaKey: true,
      shiftKey: true
    })
    expect(Object.isFrozen(onKeyDown.mock.lastCall?.[0])).toBe(true)
    expect(app).not.toHaveBeenCalled()
  })

  it('leaves keys to the app while the overlay is not interactive', () => {
    const { view, ui } = appShowingGraph()
    const onKeyDown = vi.fn()
    const handle = mount(ui, overlay({ interactive: true, onKeyDown }))
    const app = heardByApp()

    handle.setInteractive(false)
    keyDown(overlayElement(view), { key: 'Escape' })

    expect(onKeyDown).not.toHaveBeenCalled()
    expect(app).toHaveBeenCalledOnce()
  })

  it('leaves keys to the app while the overlay is hidden', () => {
    const { view, ui } = appShowingGraph()
    const onKeyDown = vi.fn()
    mount(ui, overlay({ interactive: true, visible: false, onKeyDown }))
    const app = heardByApp()

    keyDown(overlayElement(view), { key: 'Escape' })

    expect(onKeyDown).not.toHaveBeenCalled()
    expect(app).toHaveBeenCalledOnce()
  })

  it('leaves keys to the app when the pack has no key callback', () => {
    const { view, ui } = appShowingGraph()
    mount(ui, overlay({ interactive: true }))
    const app = heardByApp()

    keyDown(overlayElement(view), { key: 'Escape' })

    expect(app).toHaveBeenCalledOnce()
  })
})

describe('removing an overlay', () => {
  it('takes the overlay off the graph, stops drawing and taking presses, and frees its id', () => {
    const { view, canvas, ui } = appShowingGraph()
    const draw = vi.fn()
    const onPointerDown = vi.fn()
    const onKeyDown = vi.fn()
    const handle = mount(
      ui,
      overlay({ interactive: true, draw, onPointerDown, onKeyDown })
    )
    const element = overlayElement(view)
    const graph = heardByGraph(canvas)
    handle.redraw()

    handle.remove()
    handle.remove()
    handle.redraw()
    canvas.draw(true, true)
    press(canvas.canvas, 'pointerdown')
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(view.querySelector('[data-graph-overlay]')).toBeNull()
    expect(draw).not.toHaveBeenCalled()
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onKeyDown).not.toHaveBeenCalled()
    expect(graph).toHaveBeenCalledOnce()
    expect(() => mount(ui, overlay())).not.toThrow()
  })

  it('stops listening on the graph view for presses', () => {
    const { view, ui } = appShowingGraph()
    const handle = mount(ui, overlay({ interactive: true }))
    const stopped = vi.spyOn(view, 'removeEventListener')

    handle.remove()

    expect(stopped).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      true
    )
  })

  it('leaves alone an overlay mounted later under its id when removed again', () => {
    const { ui } = appShowingGraph()
    const first = mount(ui, overlay())
    first.remove()
    mount(ui, overlay())

    first.remove()

    expect(() => ui.mountGraphOverlay(overlay())).toThrow(
      'needs an id no mounted overlay has'
    )
  })

  it('stops following a pointer it took', () => {
    const { canvas, ui } = appShowingGraph()
    const onPointerMove = vi.fn()
    const handle = mount(ui, overlay({ interactive: true, onPointerMove }))
    const graph = heardByGraph(canvas)

    press(canvas.canvas, 'pointerdown')
    handle.remove()
    press(canvas.canvas, 'pointermove')

    expect(onPointerMove).not.toHaveBeenCalled()
    expect(graph).toHaveBeenCalledOnce()
  })
})

describe('refusing what an overlay cannot use', () => {
  it.for([
    { name: 'no overlay', definition: null, needs: 'a graph overlay' },
    {
      name: 'an empty id',
      definition: overlay({ id: ' ' }),
      needs: 'id as a non-empty string'
    },
    {
      name: 'no accessible name',
      definition: { ...overlay(), ariaLabel: undefined },
      needs: 'ariaLabel as a non-empty string'
    },
    {
      name: 'a visibility that is not a boolean',
      definition: { ...overlay(), visible: 'yes' },
      needs: 'visible as a boolean'
    },
    {
      name: 'an interactivity that is not a boolean',
      definition: { ...overlay(), interactive: 1 },
      needs: 'interactive as a boolean'
    },
    {
      name: 'no draw function',
      definition: { ...overlay(), draw: undefined },
      needs: 'draw as a function'
    },
    {
      name: 'a pointer callback that is not a function',
      definition: { ...overlay(), onPointerUp: true },
      needs: 'onPointerUp as a function'
    }
  ])('refuses $name, and mounts nothing', ({ definition, needs }) => {
    const { view, ui } = appShowingGraph()

    expect(() => Reflect.apply(ui.mountGraphOverlay, ui, [definition])).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `ui.mountGraphOverlay needs ${needs}, not `
        )
      })
    )
    expect(view.querySelector('[data-graph-overlay]')).toBeNull()
  })

  it('refuses an id already mounted, and leaves the first overlay as it was', () => {
    const { view, ui } = appShowingGraph()
    mount(ui, overlay())

    expect(() => mount(ui, overlay({ ariaLabel: 'Other' }))).toThrow(
      "ui.mountGraphOverlay needs an id no mounted overlay has, not 'MyPack.notes'."
    )
    expect(view.querySelectorAll('[data-graph-overlay]')).toHaveLength(1)
    expect(overlayElement(view).getAttribute('aria-label')).toBe('Notes')
  })

  it.for([
    { method: 'setVisible', value: 'no' },
    { method: 'setInteractive', value: 0 }
  ] as const)(
    'refuses $method with a value that is not a boolean',
    ({ method, value }) => {
      const { view, ui } = appShowingGraph()
      const handle = mount(ui, overlay())

      expect(() => Reflect.apply(handle[method], handle, [value])).toThrow(
        `${method} needs a boolean, not `
      )
      expect(overlayElement(view).hidden).toBe(false)
    }
  )

  it.for([
    {
      name: 'a region list that is not a list',
      regions: {},
      needs: 'a list of hit regions'
    },
    {
      name: 'an unknown kind',
      regions: [{ kind: 'polygon', x: 0, y: 0 }],
      needs: "regions[0].kind as 'circle' or 'rect'"
    },
    {
      name: 'a centre that is not finite',
      regions: [{ kind: 'circle', x: 0, y: Infinity, radius: 1 }],
      needs: 'regions[0].y as a finite number'
    },
    {
      name: 'an x that is not finite',
      regions: [{ kind: 'circle', x: NaN, y: 0, radius: 1 }],
      needs: 'regions[0].x as a finite number'
    },
    {
      name: 'a radius of zero',
      regions: [{ kind: 'circle', x: 0, y: 0, radius: 0 }],
      needs: 'regions[0].radius as a positive finite number'
    },
    {
      name: 'a rectangle with no height',
      regions: [
        { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
        { kind: 'rect', x: 0, y: 0, width: 1 }
      ],
      needs: 'regions[1].height as a positive finite number'
    },
    {
      name: 'a region that is not an object',
      regions: ['circle'],
      needs: 'a hit region'
    }
  ])('refuses $name, and keeps the regions it had', ({ regions, needs }) => {
    const { canvas, ui } = appShowingGraph()
    const onPointerDown = vi.fn()
    const handle = mount(ui, overlay({ interactive: true, onPointerDown }))
    handle.setHitRegions([{ kind: 'circle', x: 30, y: 40, radius: 1 }])

    expect(() =>
      Reflect.apply(handle.setHitRegions, handle, [regions])
    ).toThrow(`setHitRegions needs ${needs}, not `)
    press(canvas.canvas, 'pointerdown', { clientX: SCREEN.x + 200 })
    press(canvas.canvas, 'pointerdown', { pointerId: 2 })

    expect(onPointerDown).toHaveBeenCalledOnce()
  })
})
