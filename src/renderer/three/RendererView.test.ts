import { fromPartial } from '@total-typescript/shoehorn'
import * as THREE from 'three'
import { WebGLRenderer } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RendererView } from './RendererView'

vi.mock(import('three'), { spy: true })

function fakeRenderer() {
  const domElement = document.createElement('canvas')
  return fromPartial<WebGLRenderer>({
    domElement,
    autoClear: true,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    setSize(width: number, height: number) {
      domElement.width = width
      domElement.height = height
    },
    getSize(target: THREE.Vector2) {
      return target.set(domElement.width, domElement.height)
    },
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    forceContextLoss: vi.fn(),
    dispose: vi.fn()
  })
}

const drawImage = vi.fn()

beforeEach(() => {
  vi.mocked(WebGLRenderer).mockImplementation(fakeRenderer)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    fromPartial<CanvasRenderingContext2D & GPUCanvasContext>({
      drawImage,
      globalCompositeOperation: 'source-over'
    })
  )
})

describe('RendererView', () => {
  it('appends its own canvas to the container', () => {
    const container = document.createElement('div')

    const view = new RendererView(container)

    expect(view.canvas.parentElement).toBe(container)
    view.dispose()
    expect(view.canvas.parentElement).toBeNull()
  })

  it('setSize resizes the view canvas and grows the shared buffer to fit', () => {
    const container = document.createElement('div')
    const view = new RendererView(container)

    view.setSize(640.4, 480.6)

    expect(view.width).toBe(640)
    expect(view.height).toBe(481)
    expect(view.canvas.width).toBe(640)
    expect(view.canvas.height).toBe(481)
    expect(view.renderer.domElement.width).toBeGreaterThanOrEqual(640)
    expect(view.renderer.domElement.height).toBeGreaterThanOrEqual(481)

    view.dispose()
  })

  it('setSize clamps degenerate sizes to 1 pixel', () => {
    const container = document.createElement('div')
    const view = new RendererView(container)

    view.setSize(0, -5)

    expect(view.width).toBe(1)
    expect(view.height).toBe(1)

    view.dispose()
  })

  it('beginRender applies the view state and regrows a shrunken shared buffer', () => {
    const container = document.createElement('div')
    const view = new RendererView(container)
    view.setSize(400, 300)
    view.state.toneMapping = THREE.ACESFilmicToneMapping
    view.state.toneMappingExposure = 0.5
    view.state.outputColorSpace = THREE.LinearSRGBColorSpace
    view.state.clearAlpha = 0.25
    view.renderer.setSize(50, 40)

    view.beginRender()

    expect(view.renderer.domElement.width).toBeGreaterThanOrEqual(400)
    expect(view.renderer.domElement.height).toBeGreaterThanOrEqual(300)
    expect(view.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(view.renderer.toneMappingExposure).toBe(0.5)
    expect(view.renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace)
    expect(view.renderer.setClearColor).toHaveBeenCalledWith(
      view.state.clearColor,
      0.25
    )

    view.dispose()
  })

  it('blit copies the bottom-left region of the shared buffer into the view canvas', () => {
    const container = document.createElement('div')
    const view = new RendererView(container)
    view.renderer.setSize(1000, 800)
    view.setSize(400, 300)

    view.blit()

    expect(drawImage).toHaveBeenCalledWith(
      view.renderer.domElement,
      0,
      500,
      400,
      300,
      0,
      0,
      400,
      300
    )

    view.dispose()
  })
})
