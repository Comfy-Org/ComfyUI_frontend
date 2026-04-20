import { describe, expect, it, vi } from 'vitest'

import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onScopeDispose: vi.fn()
  }
})

describe('useGLSLRenderer', () => {
  it('returns renderer API with expected methods', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
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

  it('init returns false when WebGL2 is unavailable', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
    const renderer = useGLSLRenderer()
    expect(renderer.init(256, 256)).toBe(false)
  })

  it('compileFragment reports error before initialization', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
    const renderer = useGLSLRenderer()
    const result = renderer.compileFragment('void main() {}')
    expect(result.success).toBe(false)
  })

  it('toBlob rejects before initialization', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
    const renderer = useGLSLRenderer()
    await expect(renderer.toBlob()).rejects.toThrow('Renderer not initialized')
  })

  it('accepts custom config without error', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
    const config: GLSLRendererConfig = {
      maxInputs: 3,
      maxFloatUniforms: 2,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 2
    }
    const renderer = useGLSLRenderer(config)
    expect(renderer.init(256, 256)).toBe(false)
  })
})
