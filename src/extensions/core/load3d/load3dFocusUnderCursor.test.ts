import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachFocusUnderCursor,
  getNDCFromPointer
} from './load3dFocusUnderCursor'

type Rect = {
  left: number
  top: number
  width: number
  height: number
}

function makeCanvas(opts: { rect?: Partial<Rect>; clientSize?: number } = {}) {
  const canvas = document.createElement('canvas')
  const rect: Rect = {
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    ...opts.rect
  }
  const clientSize = opts.clientSize ?? 100
  canvas.getBoundingClientRect = vi.fn(
    () =>
      ({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({})
      }) as DOMRect
  )
  Object.defineProperty(canvas, 'clientWidth', {
    value: clientSize,
    configurable: true
  })
  Object.defineProperty(canvas, 'clientHeight', {
    value: clientSize,
    configurable: true
  })
  return canvas
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: 'pointermove' | 'pointerleave',
  x = 50,
  y = 50
) {
  const event = new Event(type) as Event & { clientX: number; clientY: number }
  event.clientX = x
  event.clientY = y
  canvas.dispatchEvent(event)
}

function dispatchKey(key: string, mods: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...mods
    })
  )
}

const fullRegion = { offsetX: 0, offsetY: 0, width: 100, height: 100 }

describe('getNDCFromPointer', () => {
  it('maps the region center to NDC (0, 0)', () => {
    const canvas = makeCanvas()
    const ndc = getNDCFromPointer(canvas, fullRegion, { x: 50, y: 50 })
    expect(ndc).not.toBeNull()
    expect(ndc!.x).toBeCloseTo(0)
    expect(ndc!.y).toBeCloseTo(0)
  })

  it('maps corners to NDC (±1, ∓1)', () => {
    const canvas = makeCanvas()
    expect(
      getNDCFromPointer(canvas, fullRegion, { x: 0, y: 0 })?.toArray()
    ).toEqual([-1, 1])
    expect(
      getNDCFromPointer(canvas, fullRegion, { x: 100, y: 100 })?.toArray()
    ).toEqual([1, -1])
  })

  it('returns null when the pointer is outside the render region', () => {
    const canvas = makeCanvas()
    expect(getNDCFromPointer(canvas, fullRegion, { x: -5, y: 50 })).toBeNull()
    expect(getNDCFromPointer(canvas, fullRegion, { x: 50, y: 105 })).toBeNull()
  })

  it('returns null when the region has zero width or height', () => {
    const canvas = makeCanvas()
    expect(
      getNDCFromPointer(
        canvas,
        { offsetX: 0, offsetY: 0, width: 0, height: 100 },
        { x: 0, y: 0 }
      )
    ).toBeNull()
    expect(
      getNDCFromPointer(
        canvas,
        { offsetX: 0, offsetY: 0, width: 100, height: 0 },
        { x: 0, y: 0 }
      )
    ).toBeNull()
  })

  it('respects letterboxed render region offsets', () => {
    const canvas = makeCanvas()
    const region = { offsetX: 10, offsetY: 10, width: 80, height: 80 }
    // Pointer at canvas center (50, 50) is the center of the rendered region.
    const center = getNDCFromPointer(canvas, region, { x: 50, y: 50 })
    expect(center!.x).toBeCloseTo(0)
    expect(center!.y).toBeCloseTo(0)
    // Pointer inside the letterbox bar (x = 5) is outside the rendered region.
    expect(getNDCFromPointer(canvas, region, { x: 5, y: 50 })).toBeNull()
  })

  it('corrects for ancestor CSS scale (graph zoom)', () => {
    // Graph zoomed 2× — bounding rect is 200 wide, but clientWidth stays 100.
    const canvas = makeCanvas({
      rect: { width: 200, height: 200 },
      clientSize: 100
    })
    // Pointer at visual center (100, 100) of the 200×200 visual rect should
    // still map to NDC (0, 0).
    const ndc = getNDCFromPointer(canvas, fullRegion, { x: 100, y: 100 })
    expect(ndc!.x).toBeCloseTo(0)
    expect(ndc!.y).toBeCloseTo(0)
  })
})

type FocusOn = (point: THREE.Vector3, distance?: number) => void

describe('attachFocusUnderCursor', () => {
  let canvas: HTMLCanvasElement
  let focusOn: ReturnType<typeof vi.fn<FocusOn>>
  let dispose: (() => void) | null
  let camera: THREE.PerspectiveCamera
  let model: THREE.Mesh | null

  beforeEach(() => {
    canvas = makeCanvas()
    focusOn = vi.fn<FocusOn>()
    dispose = null
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    model = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    )
    model.updateMatrixWorld()
  })

  afterEach(() => {
    dispose?.()
  })

  const attach = (extra: { isDisabled?: () => boolean } = {}) => {
    dispose = attachFocusUnderCursor({
      canvas,
      getModel: () => model,
      getCamera: () => camera,
      getRenderRegion: () => fullRegion,
      focusOn,
      ...extra
    })
  }

  it('triggers focusOn when F is pressed with the pointer over the canvas', () => {
    attach()
    dispatchPointer(canvas, 'pointermove', 50, 50)
    dispatchKey('f')
    expect(focusOn).toHaveBeenCalledTimes(1)
    const [point, distance] = focusOn.mock.calls[0]
    expect(point).toBeInstanceOf(THREE.Vector3)
    expect(typeof distance).toBe('number')
  })

  it('ignores keys other than F', () => {
    attach()
    dispatchPointer(canvas, 'pointermove')
    dispatchKey('a')
    dispatchKey('Enter')
    dispatchKey(' ')
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('ignores F when any modifier key is held', () => {
    attach()
    dispatchPointer(canvas, 'pointermove')
    dispatchKey('f', { ctrlKey: true })
    dispatchKey('f', { metaKey: true })
    dispatchKey('f', { altKey: true })
    dispatchKey('f', { shiftKey: true })
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('ignores F when the pointer is not over the canvas', () => {
    attach()
    // never dispatch pointermove
    dispatchKey('f')
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('ignores F after the pointer leaves the canvas', () => {
    attach()
    dispatchPointer(canvas, 'pointermove')
    dispatchPointer(canvas, 'pointerleave')
    dispatchKey('f')
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('ignores F when an editable element has focus', () => {
    attach()
    const input = document.createElement('input')
    document.body.appendChild(input)
    try {
      input.focus()
      dispatchPointer(canvas, 'pointermove')
      dispatchKey('f')
      expect(focusOn).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(input)
    }
  })

  it('ignores F when there is no model loaded', () => {
    attach()
    model = null
    dispatchPointer(canvas, 'pointermove')
    dispatchKey('f')
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('respects isDisabled', () => {
    attach({ isDisabled: () => true })
    dispatchPointer(canvas, 'pointermove')
    dispatchKey('f')
    expect(focusOn).not.toHaveBeenCalled()
  })

  it('stops responding after dispose', () => {
    attach()
    dispatchPointer(canvas, 'pointermove')
    dispose?.()
    dispose = null
    dispatchKey('f')
    expect(focusOn).not.toHaveBeenCalled()
  })
})
