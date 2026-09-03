// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import type * as ThreeModule from 'three'
import type { Camera, Scene } from 'three'

import { CameraWidget } from './CameraWidget'
import type { CameraState } from './types'

// Everything except the GPU-bound renderer runs for real: scene graph,
// raycasting and drag math are the code under test. The fake renderer updates
// world matrices the way WebGLRenderer.render does, so raycasts see current
// object positions.
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof ThreeModule>()
  class FakeWebGLRenderer {
    domElement = document.createElement('canvas')
    outputColorSpace = ''
    setSize() {}
    setPixelRatio() {}
    dispose() {}
    render(scene: Scene, camera: Camera) {
      scene.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
    }
  }
  return { ...three, WebGLRenderer: FakeWebGLRenderer }
})

const SIZE = 300

class FakeImage {
  static instances: FakeImage[] = []
  crossOrigin: string | null = null
  width = 0
  height = 0
  src = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeImage.instances.push(this)
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this)
  }
  observe() {}
  disconnect() {}
}

const fake2dContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {}
}

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

function createWidget(
  options: Partial<ConstructorParameters<typeof CameraWidget>[0]> = {}
) {
  const container = createContainer()
  const states: CameraState[] = []
  const widget = new CameraWidget({
    container,
    onStateChange: (state) => states.push(state),
    ...options
  })
  const canvas = container.querySelector('canvas')!
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: SIZE,
    bottom: SIZE,
    width: SIZE,
    height: SIZE,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
  return { widget, container, canvas, states }
}

/** Screen coordinates a world point projects to through the widget's fixed
 * scene camera (position (3.2, 2.86, 3.2) looking at (0, 0.3, 0)). */
function clientPosFor(world: Vector3) {
  const camera = new PerspectiveCamera(45, 1, 0.1, 1000)
  camera.position.set(3.2, 2.86, 3.2)
  camera.lookAt(0, 0.3, 0)
  camera.updateMatrixWorld(true)
  const ndc = world.clone().project(camera)
  return {
    clientX: ((ndc.x + 1) / 2) * SIZE,
    clientY: ((1 - ndc.y) / 2) * SIZE
  }
}

function mouseEvent(type: string, world: Vector3) {
  return new MouseEvent(type, clientPosFor(world))
}

// Handle positions at the default pose (azimuth 0, elevation 0, distance 5),
// mirroring updateVisuals: the camera indicator sits at (0, 0.5, 1.6), the
// azimuth handle on its ring at radius 1.8, the elevation handle on the arc
// at x = -0.8, and the distance handle halfway out to the indicator.
const AZIMUTH_HANDLE = new Vector3(0, 0.16, 1.8)
const ELEVATION_HANDLE = new Vector3(-0.8, 0.5, 1.4)
const DISTANCE_HANDLE = new Vector3(0, 0.5, 0.8)

describe('CameraWidget', () => {
  beforeEach(() => {
    FakeImage.instances = []
    FakeResizeObserver.instances = []
    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fake2dContext as unknown as CanvasRenderingContext2D
    )
  })

  it('starts from the provided initial state and reports it via getState', () => {
    const { widget } = createWidget({
      initialState: { azimuth: 90, elevation: 30, distance: 7 }
    })

    expect(widget.getState()).toEqual({
      azimuth: 90,
      elevation: 30,
      distance: 7,
      imageUrl: null
    })
    widget.dispose()
  })

  it('mounts its canvas into the container and removes it on dispose', () => {
    const { widget, container, canvas } = createWidget()

    expect(canvas.parentElement).toBe(container)
    widget.dispose()
    expect(container.querySelector('canvas')).toBeNull()
  })

  describe('handle dragging', () => {
    it('sets azimuth from a drag of the azimuth handle around the ring', () => {
      const { widget, canvas, states } = createWidget()

      canvas.dispatchEvent(mouseEvent('mousedown', AZIMUTH_HANDLE))
      // Ground-plane point at atan2(x, z) = 90 degrees.
      canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(1, 0, 0)))
      canvas.dispatchEvent(mouseEvent('mouseup', new Vector3(1, 0, 0)))

      expect(widget.getState().azimuth).toBeCloseTo(90, 0)
      expect(states.at(-1)?.azimuth).toBe(widget.getState().azimuth)
      widget.dispose()
    })

    it('sets elevation from a drag along the arc, clamped to [-30, 60]', () => {
      const { widget, canvas } = createWidget()

      canvas.dispatchEvent(mouseEvent('mousedown', ELEVATION_HANDLE))
      // Point on the arc plane (x = -0.8) at 30 degrees above centre height.
      const target = new Vector3(
        -0.8,
        0.5 + 1.4 * Math.sin(Math.PI / 6),
        1.4 * Math.cos(Math.PI / 6)
      )
      canvas.dispatchEvent(mouseEvent('mousemove', target))

      expect(widget.getState().elevation).toBeCloseTo(30, 0)

      // Far below the arc: clamps at the floor instead of following the ray.
      canvas.dispatchEvent(
        mouseEvent('mousemove', new Vector3(-0.8, -2.5, 0.5))
      )
      expect(widget.getState().elevation).toBe(-30)

      canvas.dispatchEvent(mouseEvent('mouseup', target))
      widget.dispose()
    })

    it('moves distance along the centre-to-camera track', () => {
      const { widget, canvas } = createWidget()

      canvas.dispatchEvent(mouseEvent('mousedown', DISTANCE_HANDLE))
      // Further out along the track (towards the camera indicator) means a
      // lower distance value (closer shot is higher distance).
      canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(0, 0.5, 1.2)))

      const dragged = widget.getState().distance
      expect(dragged).toBeLessThan(5)
      expect(dragged).toBeGreaterThan(0)

      canvas.dispatchEvent(mouseEvent('mouseup', new Vector3(0, 0.5, 1.2)))
      widget.dispose()
    })

    it('ignores drags that start away from every handle', () => {
      const { widget, canvas, states } = createWidget()

      const nowhere = new Vector3(2.5, 2.5, -2)
      canvas.dispatchEvent(mouseEvent('mousedown', nowhere))
      canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(1, 0, 0)))

      expect(widget.getState().azimuth).toBe(0)
      expect(states).toHaveLength(0)
      widget.dispose()
    })

    it('shows a grab cursor over a handle and resets it off-handle', () => {
      const { widget, canvas } = createWidget()

      canvas.dispatchEvent(mouseEvent('mousemove', AZIMUTH_HANDLE))
      expect(canvas.style.cursor).toBe('grab')

      canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(2.5, 2.5, -2)))
      expect(canvas.style.cursor).toBe('default')
      widget.dispose()
    })

    it('drives the azimuth drag from touch events too', () => {
      const { widget, canvas } = createWidget()

      const touchAt = (type: string, world: Vector3) => {
        const event = new Event(type, { cancelable: true })
        Object.assign(event, { touches: [clientPosFor(world)] })
        canvas.dispatchEvent(event)
      }

      touchAt('touchstart', AZIMUTH_HANDLE)
      touchAt('touchmove', new Vector3(1, 0, 0))
      canvas.dispatchEvent(new Event('touchend'))

      expect(widget.getState().azimuth).toBeCloseTo(90, 0)
      widget.dispose()
    })
  })

  describe('camera view', () => {
    it('orbits with pointer drags: azimuth wraps, elevation clamps', () => {
      const { widget, canvas } = createWidget()
      widget.setCameraView(true)
      expect(canvas.style.cursor).toBe('grab')

      canvas.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 100, clientY: 100 })
      )
      // deltaX 40 * 0.5 sensitivity = -20 azimuth, wrapping below 0 to 340;
      // deltaY -80 * 0.5 = -40 elevation, clamped to -30.
      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 140, clientY: 20 })
      )

      expect(widget.getState().azimuth).toBe(340)
      expect(widget.getState().elevation).toBe(-30)

      canvas.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 140, clientY: 20 })
      )
      expect(canvas.style.cursor).toBe('grab')
      widget.dispose()
    })

    it('zooms with the wheel, clamped to [0, 10]', () => {
      const { widget, canvas } = createWidget()

      // Outside camera view the wheel is left to the page.
      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, cancelable: true })
      )
      expect(widget.getState().distance).toBe(5)

      widget.setCameraView(true)
      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, cancelable: true })
      )
      expect(widget.getState().distance).toBe(6)

      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 100_000, cancelable: true })
      )
      expect(widget.getState().distance).toBe(0)
      widget.dispose()
    })

    it('restores gizmo interaction when disabled again', () => {
      const { widget, canvas } = createWidget()
      widget.setCameraView(true)
      widget.setCameraView(false)
      expect(canvas.style.cursor).toBe('default')

      canvas.dispatchEvent(mouseEvent('mousedown', AZIMUTH_HANDLE))
      canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(1, 0, 0)))
      expect(widget.getState().azimuth).toBeCloseTo(90, 0)
      widget.dispose()
    })
  })

  describe('setState and resetToDefaults', () => {
    it('applies partial updates without notifying', () => {
      const { widget, states } = createWidget()

      widget.setState({ azimuth: 180, elevation: 15 })
      expect(widget.getState()).toMatchObject({
        azimuth: 180,
        elevation: 15,
        distance: 5
      })
      expect(states).toHaveLength(0)

      widget.setState({ distance: 2 })
      expect(widget.getState().distance).toBe(2)
      widget.dispose()
    })

    it('resetToDefaults restores the default pose and notifies', () => {
      const { widget, states } = createWidget({
        initialState: { azimuth: 120, elevation: 45, distance: 9 }
      })

      widget.resetToDefaults()

      expect(widget.getState()).toEqual({
        azimuth: 0,
        elevation: 0,
        distance: 5,
        imageUrl: null
      })
      expect(states.at(-1)).toMatchObject({ azimuth: 0, distance: 5 })
      widget.dispose()
    })
  })

  describe('updateImage', () => {
    it('loads landscape and portrait sources, anonymous for remote URLs', () => {
      const { widget } = createWidget({
        initialState: { imageUrl: '/hero/input.webp' }
      })

      const first = FakeImage.instances.at(-1)!
      expect(first.src).toBe('/hero/input.webp')
      expect(first.crossOrigin).toBe('anonymous')
      first.width = 200
      first.height = 100
      first.onload?.()

      widget.setState({ imageUrl: 'data:image/png;base64,AAAA' })
      const second = FakeImage.instances.at(-1)!
      expect(second.crossOrigin).toBeNull()
      second.width = 100
      second.height = 200
      second.onload?.()

      expect(widget.getState().imageUrl).toBe('data:image/png;base64,AAAA')
      widget.dispose()
    })

    it('falls back on load errors and clears on null', () => {
      const { widget } = createWidget()

      widget.updateImage('/broken.webp')
      FakeImage.instances.at(-1)!.onerror?.()

      widget.updateImage(null)
      expect(widget.getState().imageUrl).toBeNull()
      widget.dispose()
    })

    it('drops decodes that land after dispose', () => {
      const { widget } = createWidget()
      widget.updateImage('/late.webp')
      const image = FakeImage.instances.at(-1)!

      widget.dispose()
      expect(() => {
        image.onload?.()
        image.onerror?.()
      }).not.toThrow()
    })
  })

  describe('lifecycle', () => {
    it('pause stops the animation loop and resume restarts it', () => {
      const { widget } = createWidget()

      widget.pause()
      const frame = vi.spyOn(globalThis, 'requestAnimationFrame')
      vi.advanceTimersByTime(100)
      expect(frame).not.toHaveBeenCalled()

      widget.resume()
      expect(frame).toHaveBeenCalled()

      // Resuming when not paused or after dispose is a no-op.
      widget.resume()
      widget.dispose()
      widget.resume()
      expect(widget.getState()).toBeTruthy()
    })

    it('resizes with its container and ignores zero-size layouts', () => {
      const { widget, container } = createWidget()
      const observer = FakeResizeObserver.instances.at(-1)!

      expect(() => observer.callback()).not.toThrow()

      Object.defineProperty(container, 'clientWidth', { value: 600 })
      Object.defineProperty(container, 'clientHeight', { value: 400 })
      expect(() => observer.callback()).not.toThrow()
      widget.dispose()
    })

    it('ignores pointer events after dispose without throwing', () => {
      const { widget, canvas } = createWidget()
      widget.dispose()

      expect(() => {
        canvas.dispatchEvent(mouseEvent('mousedown', AZIMUTH_HANDLE))
        canvas.dispatchEvent(mouseEvent('mousemove', new Vector3(1, 0, 0)))
      }).not.toThrow()
      expect(widget.getState().azimuth).toBe(0)
    })
  })
})
