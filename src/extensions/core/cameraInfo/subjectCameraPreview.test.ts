import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  fitCameraAspect,
  renderInsetPreview
} from './subjectCameraPreview'

function makeRenderer() {
  return {
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    render: vi.fn()
  }
}

describe('fitCameraAspect', () => {
  it('updates a perspective camera aspect', () => {
    const camera = new THREE.PerspectiveCamera(35, 1)
    fitCameraAspect(camera, 2)
    expect(camera.aspect).toBe(2)
  })

  it('widens an orthographic frustum to the aspect', () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1)
    fitCameraAspect(camera, 2)
    expect(camera.left).toBe(-2)
    expect(camera.right).toBe(2)
  })

  it('ignores a degenerate aspect', () => {
    const camera = new THREE.PerspectiveCamera(35, 1)
    fitCameraAspect(camera, 0)
    fitCameraAspect(camera, Number.NaN)
    expect(camera.aspect).toBe(1)
  })
})

describe('renderInsetPreview', () => {
  it('skips rendering when the canvas is too small for the inset', () => {
    const renderer = makeRenderer()
    renderInsetPreview({
      renderer,
      canvas: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      hidden: []
    })
    expect(renderer.render).not.toHaveBeenCalled()
  })

  it('hides visible items during the render and restores only those', () => {
    const renderer = makeRenderer()
    const visibleItem = { visible: true }
    const hiddenItem = { visible: false }
    const wrap = (item: { visible: boolean }) => ({
      isVisible: () => item.visible,
      setVisible: (v: boolean) => {
        item.visible = v
      }
    })
    renderer.render.mockImplementation(() => {
      expect(visibleItem.visible).toBe(false)
      expect(hiddenItem.visible).toBe(false)
    })

    renderInsetPreview({
      renderer,
      canvas: { width: 800, height: 600 },
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      hidden: [wrap(visibleItem), wrap(hiddenItem)]
    })

    expect(renderer.render).toHaveBeenCalledOnce()
    expect(visibleItem.visible).toBe(true)
    expect(hiddenItem.visible).toBe(false)
  })

  it('renders with the inset aspect and restores the camera afterwards', () => {
    const renderer = makeRenderer()
    const camera = new THREE.PerspectiveCamera(35, 1.5)
    renderer.render.mockImplementation(() => {
      expect(camera.aspect).toBeCloseTo(PREVIEW_WIDTH / PREVIEW_HEIGHT)
    })

    renderInsetPreview({
      renderer,
      canvas: { width: 800, height: 600 },
      scene: new THREE.Scene(),
      camera,
      hidden: []
    })

    expect(camera.aspect).toBe(1.5)
  })

  it('honours a custom layout and colours', () => {
    const renderer = makeRenderer()
    const camera = new THREE.PerspectiveCamera(35, 1)
    renderer.render.mockImplementation(() => {
      expect(camera.aspect).toBeCloseTo(1)
    })

    renderInsetPreview({
      renderer,
      canvas: { width: 800, height: 600 },
      scene: new THREE.Scene(),
      camera,
      hidden: [],
      layout: { width: 120, height: 120, marginRight: 10, marginBottom: 60 },
      borderColor: 0x112233,
      backgroundColor: '#445566'
    })

    expect(renderer.render).toHaveBeenCalledOnce()
    expect(renderer.setViewport).toHaveBeenLastCalledWith(670, 60, 120, 120)
    expect(renderer.setClearColor).toHaveBeenNthCalledWith(1, 0x112233)
    expect(renderer.setClearColor).toHaveBeenNthCalledWith(2, '#445566')
  })

  it('restores an orthographic frustum after rendering', () => {
    const renderer = makeRenderer()
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2)

    renderInsetPreview({
      renderer,
      canvas: { width: 800, height: 600 },
      scene: new THREE.Scene(),
      camera,
      hidden: []
    })

    expect(renderer.render).toHaveBeenCalledOnce()
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
      -3, 3, 2, -2
    ])
  })
})
