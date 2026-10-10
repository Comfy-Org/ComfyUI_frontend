import { fromPartial } from '@total-typescript/shoehorn'
import * as THREE from 'three'
import { WebGLRenderer } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RendererView } from './RendererView'

vi.mock(import('three'), { spy: true })

function fakeRenderer() {
  const domElement = document.createElement('canvas')
  const viewport = new THREE.Vector4()
  return fromPartial<WebGLRenderer>({
    domElement,
    setRenderTarget: vi.fn(),
    setViewport: vi.fn((x: number, y: number, w: number, h: number) => {
      viewport.set(x, y, w, h)
    }),
    getViewport: (target: THREE.Vector4) => target.copy(viewport),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    render: vi.fn(),
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

  describe('high-precision output', () => {
    function boundTarget(view: RendererView) {
      const target = vi.mocked(view.renderer.setRenderTarget).mock.lastCall![0]
      expect(target).toBeInstanceOf(THREE.WebGLRenderTarget)
      return target as THREE.WebGLRenderTarget
    }

    it('renders to the canvas unless high precision is requested', () => {
      const view = new RendererView(document.createElement('div'))
      view.setSize(400, 300)

      view.beginRender()

      expect(view.renderer.setRenderTarget).toHaveBeenLastCalledWith(null)
      expect(view.renderer.setViewport).toHaveBeenLastCalledWith(0, 0, 400, 300)

      view.dispose()
    })

    it('shares one half-float target between views, grown to the largest and encoded like the view', () => {
      const small = new RendererView(document.createElement('div'))
      const large = new RendererView(document.createElement('div'))
      small.setSize(200, 500)
      large.setSize(600, 100)
      large.state.outputColorSpace = THREE.LinearSRGBColorSpace

      small.beginRender(true)
      const first = boundTarget(small)
      large.beginRender(true)
      const second = boundTarget(large)

      expect(second).toBe(first)
      expect(second.texture.type).toBe(THREE.HalfFloatType)
      expect(second.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace)
      expect([second.width, second.height]).toEqual([600, 500])

      small.dispose()
      large.dispose()
    })

    it('mirrors viewport and scissor changes onto the bound target', () => {
      const view = new RendererView(document.createElement('div'))
      view.setSize(400, 300)
      view.beginRender(true)
      const target = boundTarget(view)

      view.setViewport(10, 20, 100, 50)
      view.setScissor(10, 20, 100, 50)
      view.setScissorTest(true)

      expect(view.renderer.setViewport).toHaveBeenLastCalledWith(
        10,
        20,
        100,
        50
      )
      expect(target.viewport.toArray()).toEqual([10, 20, 100, 50])
      expect(target.scissor.toArray()).toEqual([10, 20, 100, 50])
      expect(target.scissorTest).toBe(true)
      expect(view.getViewport(new THREE.Vector4()).toArray()).toEqual([
        10, 20, 100, 50
      ])

      view.dispose()
    })

    it('blit resolves the view region of the target to the canvas before copying it out', () => {
      const view = new RendererView(document.createElement('div'))
      view.renderer.setSize(800, 600)
      view.setSize(400, 300)
      const other = new RendererView(document.createElement('div'))
      other.setSize(800, 600)
      other.beginRender(true)
      view.beginRender(true)
      const target = boundTarget(view)

      view.blit()

      expect(view.renderer.setRenderTarget).toHaveBeenLastCalledWith(null)
      expect(view.renderer.setViewport).toHaveBeenLastCalledWith(0, 0, 400, 300)
      const [scene] = vi.mocked(view.renderer.render).mock.lastCall!
      const quad = scene.children[0] as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.ShaderMaterial
      >
      expect(quad.material.uniforms.tDiffuse.value).toBe(target.texture)
      expect(quad.material.uniforms.uvScale.value.toArray()).toEqual([0.5, 0.5])
      expect(
        vi.mocked(view.renderer.render).mock.invocationCallOrder.at(-1)
      ).toBeLessThan(drawImage.mock.invocationCallOrder.at(-1)!)

      view.dispose()
      other.dispose()
    })

    it('blit skips the resolve pass for canvas renders', () => {
      const view = new RendererView(document.createElement('div'))
      view.setSize(400, 300)
      view.beginRender()

      view.blit()

      expect(view.renderer.render).not.toHaveBeenCalled()

      view.dispose()
    })
  })
})
