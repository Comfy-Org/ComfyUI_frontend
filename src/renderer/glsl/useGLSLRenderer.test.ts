import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onScopeDispose: vi.fn()
  }
})

vi.mock('@/renderer/glsl/glslUtils', () => ({
  detectPassCount: vi.fn().mockReturnValue(1)
}))

const { detectPassCount } = await import('@/renderer/glsl/glslUtils')
const { useGLSLRenderer } = await import('@/renderer/glsl/useGLSLRenderer')

interface MockGL {
  // Constants referenced in test assertions
  TEXTURE0: number
  TRIANGLES: number
  FRAMEBUFFER: number
  UNPACK_FLIP_Y_WEBGL: number

  // GL methods
  createShader: ReturnType<typeof vi.fn>
  shaderSource: ReturnType<typeof vi.fn>
  compileShader: ReturnType<typeof vi.fn>
  getShaderParameter: ReturnType<typeof vi.fn>
  getShaderInfoLog: ReturnType<typeof vi.fn>
  deleteShader: ReturnType<typeof vi.fn>
  createProgram: ReturnType<typeof vi.fn>
  attachShader: ReturnType<typeof vi.fn>
  linkProgram: ReturnType<typeof vi.fn>
  getProgramParameter: ReturnType<typeof vi.fn>
  getProgramInfoLog: ReturnType<typeof vi.fn>
  deleteProgram: ReturnType<typeof vi.fn>
  useProgram: ReturnType<typeof vi.fn>
  createTexture: ReturnType<typeof vi.fn>
  bindTexture: ReturnType<typeof vi.fn>
  texImage2D: ReturnType<typeof vi.fn>
  texParameteri: ReturnType<typeof vi.fn>
  deleteTexture: ReturnType<typeof vi.fn>
  activeTexture: ReturnType<typeof vi.fn>
  createFramebuffer: ReturnType<typeof vi.fn>
  bindFramebuffer: ReturnType<typeof vi.fn>
  framebufferTexture2D: ReturnType<typeof vi.fn>
  checkFramebufferStatus: ReturnType<typeof vi.fn>
  deleteFramebuffer: ReturnType<typeof vi.fn>
  getUniformLocation: ReturnType<typeof vi.fn>
  uniform1f: ReturnType<typeof vi.fn>
  uniform1i: ReturnType<typeof vi.fn>
  uniform2f: ReturnType<typeof vi.fn>
  viewport: ReturnType<typeof vi.fn>
  pixelStorei: ReturnType<typeof vi.fn>
  drawArrays: ReturnType<typeof vi.fn>
  drawBuffers: ReturnType<typeof vi.fn>
  readPixels: ReturnType<typeof vi.fn>
  getExtension: ReturnType<typeof vi.fn>
  disable: ReturnType<typeof vi.fn>
  clearColor: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  [key: string]: unknown
}

function createMockGLContext(): MockGL {
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    RGBA: 0x1908,
    RGBA16F: 0x881a,
    UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140b,
    FLOAT: 0x1406,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    TRIANGLES: 0x0004,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    PACK_ROW_LENGTH: 0x0d02,
    BACK: 0x0405,
    BLEND: 0x0be2,
    COLOR_BUFFER_BIT: 0x4000,
    R16F: 0x822d,
    RED: 0x1903,

    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getShaderInfoLog: vi.fn().mockReturnValue(''),
    deleteShader: vi.fn(),

    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(''),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),

    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    deleteTexture: vi.fn(),
    activeTexture: vi.fn(),

    createFramebuffer: vi.fn(() => ({})),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn().mockReturnValue(0x8cd5),
    deleteFramebuffer: vi.fn(),

    getUniformLocation: vi.fn((_prog: unknown, name: string) => name),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),

    viewport: vi.fn(),
    pixelStorei: vi.fn(),
    drawArrays: vi.fn(),
    drawBuffers: vi.fn(),
    readPixels: vi.fn(),
    disable: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),

    getExtension: vi.fn().mockReturnValue({ loseContext: vi.fn() })
  }
}

let mockGL: MockGL

vi.stubGlobal(
  'ImageData',
  class {
    data: Uint8ClampedArray
    width: number
    height: number
    constructor(data: Uint8ClampedArray, w: number, h: number) {
      this.data = data
      this.width = w
      this.height = h
    }
  }
)

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
      return contextId === 'webgl2'
        ? (mockGL as unknown as WebGL2RenderingContext)
        : null
    }
    convertToBlob() {
      return Promise.resolve(new Blob(['fake'], { type: 'image/webp' }))
    }
  }
)

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('useGLSLRenderer', () => {
  let renderer: ReturnType<typeof useGLSLRenderer>
  const validSource = 'void main() { fragColor0 = vec4(1.0); }'

  beforeEach(() => {
    mockGL = createMockGLContext()
    vi.clearAllMocks()
    vi.mocked(detectPassCount).mockReturnValue(1)
  })

  afterEach(() => {
    renderer?.dispose()
  })

  describe('init', () => {
    it('returns true on successful initialization', () => {
      renderer = useGLSLRenderer()
      expect(renderer.init(256, 256)).toBe(true)
    })

    it('returns false when getContext returns null (non-webgl2)', () => {
      const savedGL = mockGL
      mockGL = null as unknown as MockGL
      renderer = useGLSLRenderer()
      expect(renderer.init(256, 256)).toBe(false)
      mockGL = savedGL
    })

    it('returns false after dispose', () => {
      renderer = useGLSLRenderer()
      renderer.dispose()
      expect(renderer.init(256, 256)).toBe(false)
    })

    it('creates ping-pong FBOs during initialization', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      expect(mockGL.createFramebuffer).toHaveBeenCalledTimes(2)
      expect(mockGL.checkFramebufferStatus).toHaveBeenCalledTimes(2)
    })

    it('sets UNPACK_FLIP_Y_WEBGL', () => {
      renderer = useGLSLRenderer()
      renderer.init(64, 64)
      expect(mockGL.pixelStorei).toHaveBeenCalledWith(
        mockGL.UNPACK_FLIP_Y_WEBGL,
        true
      )
    })

    it('cleans up and returns false on FBO creation failure', () => {
      mockGL.createFramebuffer.mockReturnValueOnce({}).mockReturnValueOnce(null)
      renderer = useGLSLRenderer()
      expect(renderer.init(128, 128)).toBe(false)
    })

    it('checks for EXT_color_buffer_float extension', () => {
      mockGL.getExtension.mockReturnValue(null)
      renderer = useGLSLRenderer()
      expect(renderer.init(128, 128)).toBe(false)
    })
  })

  describe('compileFragment', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
    })

    it('returns success for valid shader source', () => {
      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(true)
      expect(result.log).toBe('')
    })

    it('returns failure with log on shader compile error', () => {
      mockGL.getShaderParameter
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      mockGL.getShaderInfoLog.mockReturnValue('ERROR: syntax error')

      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(false)
      expect(result.log).toBe('ERROR: syntax error')
    })

    it('returns failure on program link error', () => {
      mockGL.getProgramParameter.mockReturnValue(false)
      mockGL.getProgramInfoLog.mockReturnValue('Link error')

      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(false)
      expect(result.log).toBe('Link error')
    })

    it('returns failure when disposed', () => {
      renderer.dispose()
      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(false)
      expect(result.log).toBe('Engine disposed')
    })

    it('uses detectPassCount to determine pass count', () => {
      vi.mocked(detectPassCount).mockReturnValue(4)
      renderer.compileFragment(validSource)
      expect(detectPassCount).toHaveBeenCalledWith(validSource)
    })

    it('caps pass count at MAX_PASSES (32)', () => {
      vi.mocked(detectPassCount).mockReturnValue(100)
      renderer.compileFragment(validSource)
      mockGL.drawArrays.mockClear()

      renderer.render()

      expect(mockGL.drawArrays).toHaveBeenCalledTimes(32)
    })

    it('deletes old shader and program before recompiling', () => {
      renderer.compileFragment(validSource)
      renderer.compileFragment('void main() { fragColor0 = vec4(0.0); }')
      expect(mockGL.deleteShader).toHaveBeenCalled()
      expect(mockGL.deleteProgram).toHaveBeenCalled()
    })

    it('returns failure when createProgram returns null', () => {
      mockGL.createProgram.mockReturnValueOnce(null)
      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(false)
      expect(result.log).toBe('Failed to create program')
    })

    it('caches uniform locations after successful compile', () => {
      renderer.compileFragment(validSource)
      expect(mockGL.getUniformLocation).toHaveBeenCalled()
    })

    it('skips recompilation for identical source', () => {
      renderer.compileFragment(validSource)
      mockGL.createShader.mockClear()

      const result = renderer.compileFragment(validSource)
      expect(result.success).toBe(true)
      expect(mockGL.createShader).not.toHaveBeenCalled()
    })
  })

  describe('setResolution', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
    })

    it('recreates ping-pong FBOs on resolution change', () => {
      mockGL.createFramebuffer.mockClear()
      renderer.setResolution(256, 256)
      expect(mockGL.createFramebuffer).toHaveBeenCalledTimes(2)
    })

    it('does nothing when resolution is unchanged', () => {
      mockGL.createFramebuffer.mockClear()
      renderer.setResolution(128, 128)
      expect(mockGL.createFramebuffer).not.toHaveBeenCalled()
    })

    it('updates viewport on resolution change', () => {
      renderer.setResolution(512, 512)
      expect(mockGL.viewport).toHaveBeenCalledWith(0, 0, 512, 512)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.viewport.mockClear()
      renderer.setResolution(512, 512)
      expect(mockGL.viewport).not.toHaveBeenCalled()
    })
  })

  describe('setFloatUniform', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
    })

    it('sets a float uniform value', () => {
      renderer.setFloatUniform(0, 3.14)
      expect(mockGL.useProgram).toHaveBeenCalled()
      expect(mockGL.uniform1f).toHaveBeenCalledWith('u_float0', 3.14)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.uniform1f.mockClear()
      renderer.setFloatUniform(0, 1.0)
      expect(mockGL.uniform1f).not.toHaveBeenCalled()
    })
  })

  describe('setIntUniform', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
    })

    it('sets an int uniform value', () => {
      renderer.setIntUniform(0, 42)
      expect(mockGL.useProgram).toHaveBeenCalled()
      expect(mockGL.uniform1i).toHaveBeenCalledWith('u_int0', 42)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.uniform1i.mockClear()
      renderer.setIntUniform(0, 1)
      expect(mockGL.uniform1i).not.toHaveBeenCalled()
    })
  })

  describe('setBoolUniform', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
    })

    it('sets a bool uniform as int 1 for true', () => {
      renderer.setBoolUniform(0, true)
      expect(mockGL.uniform1i).toHaveBeenCalledWith('u_bool0', 1)
    })

    it('sets a bool uniform as int 0 for false', () => {
      renderer.setBoolUniform(0, false)
      expect(mockGL.uniform1i).toHaveBeenCalledWith('u_bool0', 0)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.uniform1i.mockClear()
      renderer.setBoolUniform(0, true)
      expect(mockGL.uniform1i).not.toHaveBeenCalled()
    })
  })

  describe('bindCurveTexture', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
    })

    it('creates and binds a texture for the curve LUT', () => {
      const lut = new Float32Array(256)
      renderer.bindCurveTexture(0, lut)
      expect(mockGL.createTexture).toHaveBeenCalled()
      expect(mockGL.bindTexture).toHaveBeenCalled()
      expect(mockGL.texImage2D).toHaveBeenCalled()
    })

    it('ignores out-of-range index', () => {
      mockGL.createTexture.mockClear()
      renderer.bindCurveTexture(99, new Float32Array(256))
      expect(mockGL.createTexture).not.toHaveBeenCalled()
    })

    it('deletes previous texture before rebinding', () => {
      const lut = new Float32Array(256)
      renderer.bindCurveTexture(0, lut)
      mockGL.deleteTexture.mockClear()
      renderer.bindCurveTexture(0, lut)
      expect(mockGL.deleteTexture).toHaveBeenCalledTimes(1)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.createTexture.mockClear()
      renderer.bindCurveTexture(0, new Float32Array(256))
      expect(mockGL.createTexture).not.toHaveBeenCalled()
    })
  })

  describe('bindInputImage', () => {
    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
    })

    it('creates and binds a texture for the input image', () => {
      const image = new Image()
      renderer.bindInputImage(0, image)
      expect(mockGL.activeTexture).toHaveBeenCalledWith(mockGL.TEXTURE0 + 0)
      expect(mockGL.bindTexture).toHaveBeenCalled()
      expect(mockGL.texImage2D).toHaveBeenCalled()
    })

    it('throws for out-of-range index', () => {
      const image = new Image()
      expect(() => renderer.bindInputImage(5, image)).toThrow(
        'Input index 5 out of range (max 4)'
      )
      expect(() => renderer.bindInputImage(-1, image)).toThrow(
        'Input index -1 out of range'
      )
    })

    it('deletes previous texture before rebinding', () => {
      const image = new Image()
      renderer.bindInputImage(0, image)
      mockGL.deleteTexture.mockClear()
      renderer.bindInputImage(0, image)
      expect(mockGL.deleteTexture).toHaveBeenCalledTimes(1)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.createTexture.mockClear()
      renderer.bindInputImage(0, new Image())
      expect(mockGL.createTexture).not.toHaveBeenCalled()
    })
  })

  describe('render', () => {
    const source = 'void main() { fragColor0 = vec4(1.0); }'

    beforeEach(() => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(source)
    })

    it('draws a triangle', () => {
      mockGL.drawArrays.mockClear()
      renderer.render()
      expect(mockGL.drawArrays).toHaveBeenCalledWith(mockGL.TRIANGLES, 0, 3)
    })

    it('sets u_resolution uniform', () => {
      renderer.render()
      expect(mockGL.uniform2f).toHaveBeenCalledWith('u_resolution', 128, 128)
    })

    it('binds fallback texture for unbound inputs', () => {
      mockGL.bindTexture.mockClear()
      renderer.render()
      expect(mockGL.bindTexture).toHaveBeenCalled()
    })

    it('renders to default framebuffer on last pass', () => {
      mockGL.bindFramebuffer.mockClear()
      renderer.render()
      expect(mockGL.bindFramebuffer).toHaveBeenLastCalledWith(
        mockGL.FRAMEBUFFER,
        null
      )
    })

    it('performs multi-pass rendering with ping-pong FBOs', () => {
      vi.mocked(detectPassCount).mockReturnValue(3)
      renderer.compileFragment('void main() { fragColor0 = vec4(0.5); }')

      mockGL.drawArrays.mockClear()
      renderer.render()

      expect(mockGL.drawArrays).toHaveBeenCalledTimes(3)
    })

    it('does nothing when disposed', () => {
      renderer.dispose()
      mockGL.drawArrays.mockClear()
      renderer.render()
      expect(mockGL.drawArrays).not.toHaveBeenCalled()
    })

    it('does nothing without a compiled program', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      mockGL.drawArrays.mockClear()
      renderer.render()
      expect(mockGL.drawArrays).not.toHaveBeenCalled()
    })
  })

  describe('readPixels', () => {
    it('returns ImageData with correct dimensions', () => {
      renderer = useGLSLRenderer()
      renderer.init(64, 64)
      const imageData = renderer.readPixels()
      expect(imageData.width).toBe(64)
      expect(imageData.height).toBe(64)
      expect(imageData.data).toBeInstanceOf(Uint8ClampedArray)
    })

    it('throws when renderer is not initialized', () => {
      renderer = useGLSLRenderer()
      expect(() => renderer.readPixels()).toThrow('Renderer not initialized')
    })
  })

  describe('toBlob', () => {
    it('returns a Blob', async () => {
      renderer = useGLSLRenderer()
      renderer.init(64, 64)
      const blob = await renderer.toBlob()
      expect(blob).toBeInstanceOf(Blob)
    })

    it('throws when renderer is not initialized', async () => {
      renderer = useGLSLRenderer()
      await expect(renderer.toBlob()).rejects.toThrow(
        'Renderer not initialized'
      )
    })
  })

  describe('dispose', () => {
    it('cleans up all GL resources', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
      renderer.dispose()

      expect(mockGL.deleteShader).toHaveBeenCalled()
      expect(mockGL.deleteProgram).toHaveBeenCalled()
      expect(mockGL.deleteFramebuffer).toHaveBeenCalled()
      expect(mockGL.deleteTexture).toHaveBeenCalled()
      expect(mockGL.getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    })

    it('is idempotent', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.dispose()
      mockGL.getExtension.mockClear()
      renderer.dispose()
      expect(mockGL.getExtension).not.toHaveBeenCalled()
    })

    it('deletes input textures', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.bindInputImage(0, new Image())
      mockGL.deleteTexture.mockClear()
      renderer.dispose()
      expect(mockGL.deleteTexture).toHaveBeenCalled()
    })

    it('deletes curve textures', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.bindCurveTexture(0, new Float32Array(256))
      mockGL.deleteTexture.mockClear()
      renderer.dispose()
      expect(mockGL.deleteTexture).toHaveBeenCalled()
    })
  })

  describe('config', () => {
    it('accepts custom config without error', () => {
      const config: GLSLRendererConfig = {
        maxInputs: 2,
        maxFloatUniforms: 1,
        maxIntUniforms: 1,
        maxBoolUniforms: 1,
        maxCurves: 1
      }
      renderer = useGLSLRenderer(config)
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
      // 2 built-in (u_resolution, u_pass) + 2 + 1 + 1 + 1 + 1 = 8
      expect(mockGL.getUniformLocation).toHaveBeenCalledTimes(8)
    })

    it('uses default config when none provided', () => {
      renderer = useGLSLRenderer()
      renderer.init(128, 128)
      renderer.compileFragment(validSource)
      // 2 built-in + 5 inputs + 20 floats + 20 ints + 10 bools + 4 curves = 61
      expect(mockGL.getUniformLocation).toHaveBeenCalledTimes(61)
    })
  })
})
