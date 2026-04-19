import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GPUBrushRenderer } from './GPUBrushRenderer'

// WebGPU globals are not available in happy-dom
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.GPUBufferUsage = {
    VERTEX: 0x0020,
    INDEX: 0x0010,
    COPY_DST: 0x0008,
    UNIFORM: 0x0040
  }
  g.GPUTextureUsage = {
    RENDER_ATTACHMENT: 0x0010,
    TEXTURE_BINDING: 0x0004,
    COPY_SRC: 0x0001
  }
  g.GPUShaderStage = { VERTEX: 0x1, FRAGMENT: 0x2 }
})

vi.mock('typegpu', () => ({
  tgpu: { resolve: vi.fn(() => '/* mock wgsl */') }
}))

vi.mock('typegpu/data', () => ({
  struct: vi.fn(() => ({})),
  vec2f: {},
  vec3f: {},
  f32: {},
  u32: {},
  location: vi.fn(() => ({})),
  builtin: { position: {} },
  sizeOf: vi.fn(() => 16)
}))

function createMockPass() {
  return {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    setIndexBuffer: vi.fn(),
    drawIndexed: vi.fn(),
    draw: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    end: vi.fn()
  }
}

function createMockEncoder() {
  const renderPass = createMockPass()
  const computePass = createMockPass()
  return {
    beginRenderPass: vi.fn(() => renderPass),
    beginComputePass: vi.fn(() => computePass),
    finish: vi.fn(() => 'command-buffer'),
    _renderPass: renderPass,
    _computePass: computePass
  }
}

function createMockTexture(
  width = 512,
  height = 512
): GPUTexture & { _view: GPUTextureView } {
  const view = {} as GPUTextureView
  return {
    width,
    height,
    createView: vi.fn(() => view),
    destroy: vi.fn(),
    _view: view
  } as unknown as GPUTexture & { _view: GPUTextureView }
}

function createMockDevice() {
  const encoder = createMockEncoder()
  const device = {
    createBuffer: vi.fn((desc: GPUBufferDescriptor) => ({
      size: desc.size,
      getMappedRange: vi.fn(() => new ArrayBuffer(desc.size)),
      unmap: vi.fn(),
      destroy: vi.fn()
    })),
    createShaderModule: vi.fn(() => ({})),
    createBindGroupLayout: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({})),
    createComputePipeline: vi.fn(
      () =>
        ({
          getBindGroupLayout: vi.fn(() => ({}))
        }) as unknown as GPUComputePipeline
    ),
    createTexture: vi.fn((desc: { size: number[] }) =>
      createMockTexture(desc.size[0], desc.size[1])
    ),
    createCommandEncoder: vi.fn(() => encoder),
    queue: {
      writeBuffer: vi.fn(),
      submit: vi.fn()
    },
    _encoder: encoder
  }
  return device as unknown as GPUDevice & {
    _encoder: ReturnType<typeof createMockEncoder>
  }
}

describe('GPUBrushRenderer', () => {
  let device: ReturnType<typeof createMockDevice>
  let renderer: GPUBrushRenderer

  beforeEach(() => {
    vi.clearAllMocks()
    device = createMockDevice()
    renderer = new GPUBrushRenderer(device)
  })

  describe('constructor', () => {
    it('creates required GPU buffers', () => {
      // quad vertex, index, instance, uniform = 4 buffers
      expect(device.createBuffer).toHaveBeenCalledTimes(4)
    })

    it('creates shader modules', () => {
      // brushVertex, brushFragment, blit, composite (×4), readback = 8
      expect(device.createShaderModule).toHaveBeenCalled()
    })

    it('creates bind group layouts for uniforms and textures', () => {
      expect(device.createBindGroupLayout).toHaveBeenCalledTimes(2)
    })

    it('creates all render and compute pipelines', () => {
      // render, accumulate, blit, composite, compositePreview,
      // erase, erasePreview = 7 render pipelines
      expect(device.createRenderPipeline).toHaveBeenCalledTimes(7)
      // readback = 1 compute pipeline
      expect(device.createComputePipeline).toHaveBeenCalledTimes(1)
    })
  })

  describe('prepareStroke', () => {
    it('creates a new texture when none exists', () => {
      renderer.prepareStroke(256, 256)
      expect(device.createTexture).toHaveBeenCalledWith(
        expect.objectContaining({ size: [256, 256], format: 'rgba8unorm' })
      )
    })

    it('clears the accumulation texture via a render pass', () => {
      renderer.prepareStroke(256, 256)
      const encoder = device._encoder
      expect(encoder.beginRenderPass).toHaveBeenCalledWith(
        expect.objectContaining({
          colorAttachments: expect.arrayContaining([
            expect.objectContaining({ loadOp: 'clear' })
          ])
        })
      )
      expect(encoder._renderPass.end).toHaveBeenCalled()
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('reuses the texture when dimensions match', () => {
      renderer.prepareStroke(256, 256)
      const callCount = (device.createTexture as ReturnType<typeof vi.fn>).mock
        .calls.length
      renderer.prepareStroke(256, 256)
      expect(device.createTexture).toHaveBeenCalledTimes(callCount)
    })

    it('recreates the texture when dimensions change', () => {
      renderer.prepareStroke(256, 256)
      renderer.prepareStroke(512, 512)
      expect(device.createTexture).toHaveBeenCalledTimes(2)
    })
  })

  describe('renderStrokeToAccumulator', () => {
    const settings = {
      size: 10,
      opacity: 1,
      hardness: 0.5,
      color: [1, 1, 1] as [number, number, number],
      width: 256,
      height: 256,
      brushShape: 0
    }

    it('does nothing when no stroke texture is prepared', () => {
      renderer.renderStrokeToAccumulator(
        [{ x: 0, y: 0, pressure: 1 }],
        settings
      )
      expect(device.queue.writeBuffer).not.toHaveBeenCalled()
    })

    it('writes uniforms and instance data then submits', () => {
      renderer.prepareStroke(256, 256)
      vi.clearAllMocks()

      const points = [
        { x: 10, y: 20, pressure: 0.5 },
        { x: 30, y: 40, pressure: 1.0 }
      ]
      renderer.renderStrokeToAccumulator(points, settings)

      // uniform + instance data = 2 writeBuffer calls
      expect(device.queue.writeBuffer).toHaveBeenCalledTimes(2)
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('does not render when points array is empty', () => {
      renderer.prepareStroke(256, 256)
      vi.clearAllMocks()

      renderer.renderStrokeToAccumulator([], settings)
      // writeBuffer is never called because renderStrokeInternal returns early
      expect(device.queue.writeBuffer).not.toHaveBeenCalled()
    })
  })

  describe('renderStroke', () => {
    const settings = {
      size: 10,
      opacity: 1,
      hardness: 0.5,
      color: [1, 0, 0] as [number, number, number],
      width: 512,
      height: 512,
      brushShape: 0
    }

    it('renders points directly to the target view', () => {
      const targetView = {} as GPUTextureView
      const points = [{ x: 5, y: 5, pressure: 1 }]

      renderer.renderStroke(targetView, points, settings)

      expect(device.queue.writeBuffer).toHaveBeenCalledTimes(2)
      const encoder = device._encoder
      expect(encoder._renderPass.setPipeline).toHaveBeenCalled()
      expect(encoder._renderPass.drawIndexed).toHaveBeenCalledWith(6, 1)
    })

    it('skips rendering for empty points', () => {
      const targetView = {} as GPUTextureView
      renderer.renderStroke(targetView, [], settings)
      expect(device.queue.writeBuffer).not.toHaveBeenCalled()
    })
  })

  describe('compositeStroke', () => {
    const settings = {
      opacity: 0.8,
      color: [1, 0, 0] as [number, number, number],
      hardness: 0.5,
      screenSize: [512, 512] as [number, number],
      brushShape: 0
    }

    it('does nothing when no stroke texture exists', () => {
      const targetView = {} as GPUTextureView
      renderer.compositeStroke(targetView, settings)
      expect(device.queue.writeBuffer).not.toHaveBeenCalled()
    })

    it('writes uniforms and submits a composite pass', () => {
      renderer.prepareStroke(512, 512)
      vi.clearAllMocks()

      const targetView = {} as GPUTextureView
      renderer.compositeStroke(targetView, settings)

      expect(device.queue.writeBuffer).toHaveBeenCalledTimes(1)
      expect(device.createBindGroup).toHaveBeenCalled()
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('uses erase pipeline when isErasing is true', () => {
      renderer.prepareStroke(512, 512)
      vi.clearAllMocks()

      const targetView = {} as GPUTextureView
      renderer.compositeStroke(targetView, { ...settings, isErasing: true })

      const encoder = device._encoder
      expect(encoder._renderPass.setPipeline).toHaveBeenCalled()
      expect(encoder._renderPass.draw).toHaveBeenCalledWith(3)
    })
  })

  describe('blitToCanvas', () => {
    const mockCtx = {
      getCurrentTexture: vi.fn(() => createMockTexture())
    } as unknown as GPUCanvasContext

    const settings = {
      opacity: 1,
      color: [1, 1, 1] as [number, number, number],
      hardness: 0.5,
      screenSize: [512, 512] as [number, number],
      brushShape: 0
    }

    it('clears destination when no background texture is provided', () => {
      renderer.blitToCanvas(mockCtx, settings)

      const encoder = device._encoder
      expect(encoder.beginRenderPass).toHaveBeenCalledWith(
        expect.objectContaining({
          colorAttachments: expect.arrayContaining([
            expect.objectContaining({ loadOp: 'clear' })
          ])
        })
      )
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('draws background texture when provided', () => {
      const bgTexture = createMockTexture()
      renderer.blitToCanvas(mockCtx, settings, bgTexture)

      expect(device.createBindGroup).toHaveBeenCalled()
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('composites the stroke texture when prepared', () => {
      renderer.prepareStroke(512, 512)
      vi.clearAllMocks()

      renderer.blitToCanvas(mockCtx, settings)

      // Writes uniforms for the preview pass
      expect(device.queue.writeBuffer).toHaveBeenCalled()
      expect(device.queue.submit).toHaveBeenCalled()
    })

    it('uses erase preview pipeline when isErasing is true', () => {
      renderer.prepareStroke(512, 512)
      vi.clearAllMocks()

      renderer.blitToCanvas(mockCtx, { ...settings, isErasing: true })

      const encoder = device._encoder
      expect(encoder._renderPass.setPipeline).toHaveBeenCalled()
    })
  })

  describe('clearPreview', () => {
    it('submits a clear render pass', () => {
      const mockCtx = {
        getCurrentTexture: vi.fn(() => createMockTexture())
      } as unknown as GPUCanvasContext

      renderer.clearPreview(mockCtx)

      const encoder = device._encoder
      expect(encoder.beginRenderPass).toHaveBeenCalledWith(
        expect.objectContaining({
          colorAttachments: expect.arrayContaining([
            expect.objectContaining({
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 }
            })
          ])
        })
      )
      expect(encoder._renderPass.end).toHaveBeenCalled()
      expect(device.queue.submit).toHaveBeenCalled()
    })
  })

  describe('prepareReadback', () => {
    it('creates a bind group and dispatches a compute pass', () => {
      const texture = createMockTexture(64, 64)
      const outputBuffer = { size: 64 * 64 * 4 } as GPUBuffer

      renderer.prepareReadback(texture, outputBuffer)

      expect(device.queue.submit).toHaveBeenCalled()
      const encoder = device._encoder
      expect(encoder.beginComputePass).toHaveBeenCalled()
      expect(encoder._computePass.setPipeline).toHaveBeenCalled()
      expect(encoder._computePass.dispatchWorkgroups).toHaveBeenCalledWith(
        Math.ceil(64 / 8),
        Math.ceil(64 / 8)
      )
    })

    it('reuses the bind group for the same texture and buffer', () => {
      const texture = createMockTexture(64, 64)
      const outputBuffer = { size: 64 * 64 * 4 } as GPUBuffer

      renderer.prepareReadback(texture, outputBuffer)
      const firstCallCount = (
        device.createBindGroup as ReturnType<typeof vi.fn>
      ).mock.calls.length

      renderer.prepareReadback(texture, outputBuffer)
      // +1 from constructor for mainUniformBindGroup is already counted
      expect(device.createBindGroup).toHaveBeenCalledTimes(firstCallCount)
    })

    it('recreates the bind group when texture changes', () => {
      const texture1 = createMockTexture(64, 64)
      const texture2 = createMockTexture(128, 128)
      const outputBuffer = { size: 128 * 128 * 4 } as GPUBuffer

      renderer.prepareReadback(texture1, outputBuffer)
      const afterFirst = (device.createBindGroup as ReturnType<typeof vi.fn>)
        .mock.calls.length

      renderer.prepareReadback(texture2, outputBuffer)
      expect(device.createBindGroup).toHaveBeenCalledTimes(afterFirst + 1)
    })
  })

  describe('destroy', () => {
    it('destroys all GPU buffers', () => {
      renderer.destroy()

      // 4 buffers created in constructor
      const buffers = (device.createBuffer as ReturnType<typeof vi.fn>).mock
        .results
      for (const result of buffers) {
        expect(result.value.destroy).toHaveBeenCalled()
      }
    })

    it('destroys the stroke texture if one was created', () => {
      renderer.prepareStroke(256, 256)
      const texture = (device.createTexture as ReturnType<typeof vi.fn>).mock
        .results[0].value

      renderer.destroy()
      expect(texture.destroy).toHaveBeenCalled()
    })

    it('does not throw when no stroke texture exists', () => {
      expect(() => renderer.destroy()).not.toThrow()
    })
  })
})
