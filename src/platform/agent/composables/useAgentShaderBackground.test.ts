import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'

import type { AgentShaderParams } from '@/platform/agent/composables/agentPersonalityState'
import { useAgentShaderBackground } from '@/platform/agent/composables/useAgentShaderBackground'

const DEFAULT_PARAMS: AgentShaderParams = {
  hueBase: 45,
  hueRange: 40,
  speed: 0.6,
  scale: 3,
  intensity: 0.8,
  glow: 0.5
}

function createMockGL2Context() {
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    COLOR_BUFFER_BIT: 0x4000,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    TRIANGLES: 0x0004,
    createShader: vi.fn().mockReturnValue({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    deleteShader: vi.fn(),
    createProgram: vi.fn().mockReturnValue({}),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    deleteProgram: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue(null),
    useProgram: vi.fn(),
    uniform1f: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn()
  }
}

// `HTMLCanvasElement.prototype.getContext` is overloaded per contextId, which
// collapses `vi.spyOn`'s inferred return type to a single unrelated overload
// (e.g. `GPUCanvasContext`). Casting through this narrow interface avoids
// fighting that inference for a mock instance's actual method availability.
function mockGetContext(value: unknown) {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  const castSpy = spy as unknown as { mockReturnValue: (v: unknown) => void }
  castSpy.mockReturnValue(value)
}

function mountShaderBackground(reducedMotion = false) {
  let result: ReturnType<typeof useAgentShaderBackground> | undefined

  const Child = defineComponent({
    setup() {
      const canvasRef = ref<HTMLCanvasElement>()
      result = useAgentShaderBackground(
        canvasRef,
        DEFAULT_PARAMS,
        ref(reducedMotion)
      )
      return () => h('canvas', { ref: canvasRef })
    }
  })

  const host = document.createElement('div')
  const app = createApp(Child)
  app.mount(host)

  if (!result) throw new Error('useAgentShaderBackground did not initialize')
  return { isSupported: result.isSupported, unmount: () => app.unmount() }
}

describe('useAgentShaderBackground', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('no-ops gracefully when WebGL2 is unavailable', () => {
    mockGetContext(null)

    const { isSupported, unmount } = mountShaderBackground()

    expect(isSupported.value).toBe(false)
    expect(() => unmount()).not.toThrow()
  })

  it('marks itself supported and disconnects the resize observer on unmount', () => {
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = disconnect
        unobserve = vi.fn()
      }
    )
    mockGetContext(createMockGL2Context())

    const { isSupported, unmount } = mountShaderBackground()

    expect(isSupported.value).toBe(true)

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
