import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLRenderer } from '@/renderer/glsl/useGLSLRenderer'

const mockBlob = new Blob(['test'], { type: 'image/jpeg' })

const mockConvertToBlob = vi.fn().mockResolvedValue(mockBlob)

// Stub OffscreenCanvas so init() succeeds in happy-dom
vi.stubGlobal(
  'OffscreenCanvas',
  class {
    width: number
    height: number
    constructor(w: number, h: number) {
      this.width = w
      this.height = h
    }
    convertToBlob = mockConvertToBlob
    getContext() {
      return createMockGL()
    }
  }
)

function createMockGL() {
  const noop = () => {}
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'VERTEX_SHADER') return 35633
        if (prop === 'FRAGMENT_SHADER') return 35632
        if (prop === 'COMPILE_STATUS') return 35713
        if (prop === 'LINK_STATUS') return 35714
        if (prop === 'FRAMEBUFFER') return 36160
        if (prop === 'FRAMEBUFFER_COMPLETE') return 36053
        if (prop === 'COLOR_ATTACHMENT0') return 36064
        if (prop === 'TEXTURE_2D') return 3553
        if (prop === 'TEXTURE0') return 33984
        if (prop === 'RGBA') return 6408
        if (prop === 'RGBA8') return 32856
        if (prop === 'UNSIGNED_BYTE') return 5121
        if (prop === 'TEXTURE_MIN_FILTER') return 10241
        if (prop === 'TEXTURE_MAG_FILTER') return 10240
        if (prop === 'TEXTURE_WRAP_S') return 10242
        if (prop === 'TEXTURE_WRAP_T') return 10243
        if (prop === 'LINEAR') return 9729
        if (prop === 'CLAMP_TO_EDGE') return 33071
        if (prop === 'TRIANGLES') return 4
        if (prop === 'BACK') return 1029
        if (prop === 'UNPACK_FLIP_Y_WEBGL') return 37440
        if (prop === 'PACK_ROW_LENGTH') return 3330
        if (typeof prop === 'string' && prop.startsWith('get')) {
          return (..._args: unknown[]) => {
            if (prop === 'getShaderParameter') return true
            if (prop === 'getProgramParameter') return true
            if (prop === 'getExtension') return { loseContext: noop }
            if (prop === 'getUniformLocation') return 1
            return null
          }
        }
        if (
          typeof prop === 'string' &&
          (prop.startsWith('create') || prop === 'checkFramebufferStatus')
        ) {
          return () => {
            if (prop === 'checkFramebufferStatus') return 36053
            return {}
          }
        }
        return noop
      }
    }
  )
}

describe('useGLSLRenderer', () => {
  it('returns renderer API with expected methods', () => {
    const renderer = useGLSLRenderer()

    expect(renderer).toHaveProperty('init')
    expect(renderer).toHaveProperty('compileFragment')
    expect(renderer).toHaveProperty('setResolution')
    expect(renderer).toHaveProperty('setFloatUniform')
    expect(renderer).toHaveProperty('setIntUniform')
    expect(renderer).toHaveProperty('bindInputImage')
    expect(renderer).toHaveProperty('render')
    expect(renderer).toHaveProperty('readPixels')
    expect(renderer).toHaveProperty('toBlob')
    expect(renderer).toHaveProperty('dispose')
  })

  it('init returns false when WebGL2 is unavailable', () => {
    const origOffscreenCanvas = globalThis.OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', undefined)
    const renderer = useGLSLRenderer()
    expect(renderer.init(256, 256)).toBe(false)
    vi.stubGlobal('OffscreenCanvas', origOffscreenCanvas)
  })

  it('compileFragment reports error before initialization', () => {
    const origOffscreenCanvas = globalThis.OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', undefined)
    const renderer = useGLSLRenderer()
    const result = renderer.compileFragment('void main() {}')
    expect(result.success).toBe(false)
    vi.stubGlobal('OffscreenCanvas', origOffscreenCanvas)
  })

  it('toBlob rejects before initialization', async () => {
    const origOffscreenCanvas = globalThis.OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', undefined)
    const renderer = useGLSLRenderer()
    await expect(renderer.toBlob()).rejects.toThrow('Renderer not initialized')
    vi.stubGlobal('OffscreenCanvas', origOffscreenCanvas)
  })

  it('accepts custom config without error', () => {
    const origOffscreenCanvas = globalThis.OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', undefined)
    const config: GLSLRendererConfig = {
      maxInputs: 3,
      maxFloatUniforms: 2,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 2
    }
    const renderer = useGLSLRenderer(config)
    expect(renderer.init(256, 256)).toBe(false)
    vi.stubGlobal('OffscreenCanvas', origOffscreenCanvas)
  })
})

describe('useGLSLRenderer debounced toBlob', () => {
  let renderer: ReturnType<typeof useGLSLRenderer>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    renderer = useGLSLRenderer()
    renderer.init(100, 100)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays convertToBlob execution by the debounce period', () => {
    renderer.debouncedToBlob()

    expect(mockConvertToBlob).not.toHaveBeenCalled()

    vi.advanceTimersByTime(150)

    expect(mockConvertToBlob).toHaveBeenCalledOnce()
  })

  it('coalesces rapid calls into a single convertToBlob', () => {
    renderer.debouncedToBlob()
    vi.advanceTimersByTime(50)
    renderer.debouncedToBlob()
    vi.advanceTimersByTime(50)
    renderer.debouncedToBlob()

    vi.advanceTimersByTime(150)

    expect(mockConvertToBlob).toHaveBeenCalledOnce()
  })

  it('cancelPendingBlob prevents the conversion from running', () => {
    renderer.debouncedToBlob()
    renderer.cancelPendingBlob()

    vi.advanceTimersByTime(200)

    expect(mockConvertToBlob).not.toHaveBeenCalled()
  })

  it('dispose cancels pending blob conversions', () => {
    renderer.debouncedToBlob()
    renderer.dispose()

    vi.advanceTimersByTime(200)

    expect(mockConvertToBlob).not.toHaveBeenCalled()
  })
})
