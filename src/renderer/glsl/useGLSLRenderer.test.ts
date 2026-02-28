import { describe, expect, it, vi } from 'vitest'

import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onScopeDispose: vi.fn()
  }
})

describe('GLSLRendererConfig', () => {
  it('exports a valid config interface type', () => {
    const config: GLSLRendererConfig = {
      maxInputs: 3,
      maxFloatUniforms: 4,
      maxIntUniforms: 2
    }
    expect(config.maxInputs).toBe(3)
    expect(config.maxFloatUniforms).toBe(4)
    expect(config.maxIntUniforms).toBe(2)
  })
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

  it('accepts custom config', async () => {
    const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')
    const config: GLSLRendererConfig = {
      maxInputs: 3,
      maxFloatUniforms: 2,
      maxIntUniforms: 1
    }
    const renderer = useGLSLRenderer(config)
    expect(renderer).toBeDefined()
  })
})
