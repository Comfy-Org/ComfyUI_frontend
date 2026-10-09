import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, shallowRef } from 'vue'

import type { EditorZoom } from './useEditorZoom'
import { useEditorZoom } from './useEditorZoom'

interface Editor {
  zoom: EditorZoom
  canvas: HTMLElement
  frame: HTMLElement
  backdrop: HTMLElement
  stop: () => void
}

let editor: Editor | undefined

function mountEditor(): Editor {
  const canvas = document.createElement('div')
  const backdrop = document.createElement('div')
  const frame = document.createElement('div')
  Object.defineProperty(frame, 'offsetWidth', { value: 400 })
  Object.defineProperty(frame, 'offsetHeight', { value: 300 })
  canvas.append(backdrop, frame)
  document.body.append(canvas)

  const scope = effectScope()
  const zoom = scope.run(() => useEditorZoom(shallowRef(canvas)))
  if (!zoom) throw new Error('useEditorZoom did not run')
  zoom.frame.value = frame
  editor = {
    zoom,
    canvas,
    frame,
    backdrop,
    stop: () => {
      scope.stop()
      canvas.remove()
    }
  }
  return editor
}

afterEach(() => {
  editor?.stop()
  editor = undefined
})

function press(key: string, init: KeyboardEventInit = {}, target = window) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...init })
  )
}

function wheel(canvas: HTMLElement, init: WheelEventInit) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: 200,
    clientY: 150,
    ...init
  })
  // happy-dom's WheelEvent drops the modifier keys from its init.
  Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false })
  canvas.dispatchEvent(event)
}

function pointer(
  target: HTMLElement,
  type: string,
  init: PointerEventInit = {}
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    ...init
  })
  target.dispatchEvent(event)
  return event
}

describe('useEditorZoom', () => {
  it.for([
    { keys: ['+'], percent: 125 },
    { keys: ['='], percent: 125 },
    { keys: ['+', '-'], percent: 100 },
    { keys: ['+', '+', '0'], percent: 100 },
    { keys: ['_'], percent: 80 }
  ])('reads $percent% after pressing $keys', ({ keys, percent }) => {
    const { zoom } = mountEditor()
    for (const key of keys) press(key)
    expect(zoom.percent.value).toBe(percent)
  })

  it('leaves the zoom alone while typing or with a modifier held', () => {
    const { zoom, canvas } = mountEditor()
    const field = document.createElement('input')
    canvas.append(field)

    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', bubbles: true })
    )
    press('+', { ctrlKey: true })

    expect(zoom.percent.value).toBe(100)
  })

  it('zooms on a ctrl wheel and pans on a plain wheel only once zoomed', () => {
    const { zoom, canvas } = mountEditor()

    wheel(canvas, { deltaX: 30, deltaY: 40 })
    expect(zoom.view.value).toEqual({ scale: 1, x: 0, y: 0 })

    wheel(canvas, { deltaY: -40, ctrlKey: true })
    expect(zoom.percent.value).toBeGreaterThan(100)

    const before = zoom.view.value
    wheel(canvas, { deltaX: 30, deltaY: 0 })
    expect(zoom.view.value.x).toBe(before.x - 30)
  })

  it('pans by dragging the empty canvas once zoomed, and not before', () => {
    const { zoom, backdrop, canvas } = mountEditor()

    expect(pointer(backdrop, 'pointerdown').defaultPrevented).toBe(false)
    pointer(canvas, 'pointerup')

    zoom.zoomIn()
    const start = zoom.view.value
    expect(
      pointer(backdrop, 'pointerdown', { clientX: 100, clientY: 100 })
        .defaultPrevented
    ).toBe(true)
    pointer(canvas, 'pointermove', { clientX: 80, clientY: 90 })
    pointer(canvas, 'pointerup')

    expect(zoom.view.value).toMatchObject({
      x: start.x - 20,
      y: start.y - 10
    })
  })

  it('leaves a drag on the stage to the app until space is held', () => {
    const { zoom, frame } = mountEditor()
    zoom.zoomIn()

    expect(pointer(frame, 'pointerdown').defaultPrevented).toBe(false)
    pointer(frame, 'pointerup')

    press(' ')
    expect(pointer(frame, 'pointerdown').defaultPrevented).toBe(true)
  })

  it('goes back to fitting the frame', () => {
    const { zoom } = mountEditor()
    zoom.zoomIn()
    zoom.zoomIn()

    zoom.fit()

    expect(zoom.view.value).toEqual({ scale: 1, x: 0, y: 0 })
    expect(zoom.percent.value).toBe(100)
  })
})
