import { beforeEach, describe, expect, it, vi } from 'vitest'

import { acquireSharedGL } from '@/renderer/glsl/sharedGLContext'

interface MockGL {
  getExtension: ReturnType<typeof vi.fn>
  pixelStorei: ReturnType<typeof vi.fn>
  isContextLost: ReturnType<typeof vi.fn>
}

let mockGL: MockGL
let loseContext: ReturnType<typeof vi.fn>
let getContextCalls: number

function createMockGL(): MockGL {
  return {
    getExtension: vi.fn((name: string) => {
      if (name === 'EXT_color_buffer_float') return {}
      if (name === 'WEBGL_lose_context') return { loseContext }
      return null
    }),
    pixelStorei: vi.fn(),
    isContextLost: vi.fn(() => false)
  }
}

describe('acquireSharedGL', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number
        height: number
        constructor(w: number, h: number) {
          this.width = w
          this.height = h
        }
        getContext(contextId: string) {
          if (contextId !== 'webgl2') return null
          getContextCalls++
          return mockGL as unknown as WebGL2RenderingContext
        }
      }
    )
    loseContext = vi.fn()
    mockGL = createMockGL()
    getContextCalls = 0
  })

  it('returns the same context for concurrent holders', () => {
    const a = acquireSharedGL()
    const b = acquireSharedGL()

    expect(a).not.toBeNull()
    expect(b?.gl).toBe(a?.gl)
    expect(b?.canvas).toBe(a?.canvas)
    expect(getContextCalls).toBe(1)

    a?.release()
    b?.release()
  })

  it('destroys the context only when the last holder releases', () => {
    const a = acquireSharedGL()
    const b = acquireSharedGL()

    a?.release()
    expect(loseContext).not.toHaveBeenCalled()

    b?.release()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('ignores repeated release of the same handle', () => {
    const a = acquireSharedGL()
    const b = acquireSharedGL()

    a?.release()
    a?.release()
    expect(loseContext).not.toHaveBeenCalled()

    b?.release()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh context after full release', () => {
    const a = acquireSharedGL()
    a?.release()

    const b = acquireSharedGL()
    expect(b).not.toBeNull()
    expect(getContextCalls).toBe(2)

    b?.release()
  })

  it('replaces a lost context on the next acquire', () => {
    const a = acquireSharedGL()
    mockGL.isContextLost.mockReturnValue(true)

    const freshGL = createMockGL()
    const staleGL = mockGL
    mockGL = freshGL
    const b = acquireSharedGL()

    expect(b).not.toBeNull()
    expect(b?.gl).not.toBe(staleGL)
    expect(getContextCalls).toBe(2)

    a?.release()
    b?.release()
  })

  it('returns null when webgl2 is unavailable', () => {
    const savedGL = mockGL
    mockGL = null as unknown as MockGL
    expect(acquireSharedGL()).toBeNull()
    mockGL = savedGL
  })

  it('loses the context and returns null when EXT_color_buffer_float is missing', () => {
    mockGL.getExtension = vi.fn((name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext } : null
    )
    expect(acquireSharedGL()).toBeNull()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('sets UNPACK_FLIP_Y_WEBGL once at context creation', () => {
    const a = acquireSharedGL()
    const b = acquireSharedGL()

    expect(mockGL.pixelStorei).toHaveBeenCalledTimes(1)

    a?.release()
    b?.release()
  })
})
