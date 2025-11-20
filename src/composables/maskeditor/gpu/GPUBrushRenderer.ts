import * as d from 'typegpu/data'
import { StrokePoint } from './gpuSchema'
import {
  brushFragment,
  brushVertex,
  blitShader,
  compositeShader,
  readbackShader
} from './brushShaders'

// ... (rest of the file)

const QUAD_VERTS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3])

const UNIFORM_SIZE = 48 // 32 + 16 padding/alignment safety, actually struct is: vec3(12)+pad(4) + f32(4) + f32(4) + vec2(8) + u32(4) = 36 -> 48 aligned
const STROKE_STRIDE = d.sizeOf(StrokePoint) // 16
const MAX_STROKES = 10000

export class GPUBrushRenderer {
  private device: GPUDevice

  // Buffers
  private quadVertexBuffer: GPUBuffer
  private indexBuffer: GPUBuffer
  private instanceBuffer: GPUBuffer
  private uniformBuffer: GPUBuffer

  // Pipelines
  private renderPipeline: GPURenderPipeline // Standard alpha blend (for composite)
  private accumulatePipeline: GPURenderPipeline // SourceOver blend (for accumulation)
  private blitPipeline: GPURenderPipeline
  private compositePipeline: GPURenderPipeline // Multiplies by opacity
  private compositePipelinePreview: GPURenderPipeline // For preview canvas
  private erasePipeline: GPURenderPipeline // Destination Out blending
  private erasePipelinePreview: GPURenderPipeline // For preview canvas
  readbackPipeline: GPUComputePipeline // For fast readback
  private uniformBindGroup: GPUBindGroup

  // Textures
  private currentStrokeTexture: GPUTexture | null = null
  private currentStrokeView: GPUTextureView | null = null

  constructor(
    device: GPUDevice,
    presentationFormat: GPUTextureFormat = 'rgba8unorm'
  ) {
    this.device = device

    // --- 1. Initialize Buffers ---
    this.quadVertexBuffer = device.createBuffer({
      size: QUAD_VERTS.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    })
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(QUAD_VERTS)
    this.quadVertexBuffer.unmap()

    this.indexBuffer = device.createBuffer({
      size: QUAD_INDICES.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    })
    new Uint16Array(this.indexBuffer.getMappedRange()).set(QUAD_INDICES)
    this.indexBuffer.unmap()

    this.instanceBuffer = device.createBuffer({
      size: MAX_STROKES * STROKE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    // --- 2. Brush Shader (Drawing) ---
    // Shaders are imported from ./brushShaders.ts

    const brushModuleV = device.createShaderModule({ code: brushVertex })
    const brushModuleF = device.createShaderModule({ code: brushFragment })

    const uniformBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    })

    this.uniformBindGroup = device.createBindGroup({
      layout: uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
    })

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout]
    })

    // Standard Render Pipeline (Alpha Blend)
    this.renderPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: brushModuleV,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 8,
            stepMode: 'vertex',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] // Quad
          },
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x2' }, // pos
              { shaderLocation: 2, offset: 8, format: 'float32' }, // size
              { shaderLocation: 3, offset: 12, format: 'float32' } // pressure
            ]
          }
        ]
      },
      fragment: {
        module: brushModuleF,
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba8unorm',
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // Accumulate Pipeline - Uses SourceOver to smooth intersections
    // We rely on the composite pass to limit the opacity.
    this.accumulatePipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: brushModuleV,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 8,
            stepMode: 'vertex',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
          },
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x2' },
              { shaderLocation: 2, offset: 8, format: 'float32' },
              { shaderLocation: 3, offset: 12, format: 'float32' }
            ]
          }
        ]
      },
      fragment: {
        module: brushModuleF,
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba8unorm',
            blend: {
              // SourceOver (Standard Premultiplied Alpha Blend)
              // This ensures smooth intersections (no MAX creases)
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // --- 3. Blit Pipeline (For Preview) ---
    // Shader is imported from ./brushShaders.ts

    this.blitPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: blitShader }),
        entryPoint: 'vs'
      },
      fragment: {
        module: device.createShaderModule({ code: blitShader }),
        entryPoint: 'fs',
        targets: [
          {
            format: presentationFormat, // Use the passed format (e.g. bgra8unorm)
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // --- 4. Composite Pipeline (Merge Accumulator to Main) ---
    // Multiplies the accumulated coverage by the brush opacity
    // Shader is imported from ./brushShaders.ts

    // Standard Composite (for RGBA8Unorm offscreen textures)
    this.compositePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'vs'
      },
      fragment: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba8unorm',
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // Preview Composite (for Presentation Format)
    this.compositePipelinePreview = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'vs'
      },
      fragment: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'fs',
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // --- 5. Erase Pipeline (Destination Out) ---
    // Standard Erase (for RGBA8Unorm offscreen textures)
    this.erasePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'vs'
      },
      fragment: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba8unorm',
            blend: {
              color: {
                srcFactor: 'zero',
                dstFactor: 'one-minus-src-alpha', // dst * (1 - src_alpha)
                operation: 'add'
              },
              alpha: {
                srcFactor: 'zero',
                dstFactor: 'one-minus-src-alpha', // dst_alpha * (1 - src_alpha)
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // Preview Erase (for Presentation Format)
    this.erasePipelinePreview = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'vs'
      },
      fragment: {
        module: device.createShaderModule({ code: compositeShader }),
        entryPoint: 'fs',
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                srcFactor: 'zero',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'zero',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: { topology: 'triangle-list' }
    })

    // --- 6. Readback Pipeline (Compute) ---
    this.readbackPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: readbackShader }),
        entryPoint: 'main'
      }
    })
  }

  public prepareStroke(width: number, height: number) {
    // Create or resize accumulation texture if needed
    if (
      !this.currentStrokeTexture ||
      this.currentStrokeTexture.width !== width ||
      this.currentStrokeTexture.height !== height
    ) {
      if (this.currentStrokeTexture) this.currentStrokeTexture.destroy()
      this.currentStrokeTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC
      })
      this.currentStrokeView = this.currentStrokeTexture.createView()
    }

    // Clear the accumulation texture
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.currentStrokeView!,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store'
        }
      ]
    })
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  public renderStrokeToAccumulator(
    points: { x: number; y: number; pressure: number }[],
    settings: {
      size: number
      opacity: number
      hardness: number
      color: [number, number, number]
      width: number
      height: number
      brushShape: number
    }
  ) {
    if (!this.currentStrokeView) return
    // Use accumulatePipeline (SourceOver)
    this.renderStrokeInternal(
      this.currentStrokeView,
      this.accumulatePipeline,
      points,
      settings
    )
  }

  public compositeStroke(
    targetView: GPUTextureView,
    settings: {
      opacity: number
      color: [number, number, number]
      hardness: number // Needed for uniforms, though unused in composite shader
      screenSize: [number, number]
      brushShape: number
      isErasing?: boolean
    }
  ) {
    if (!this.currentStrokeTexture) return

    // Update Uniforms for Composite Pass (specifically Opacity)
    const buffer = new ArrayBuffer(UNIFORM_SIZE)
    const f32 = new Float32Array(buffer)
    const u32 = new Uint32Array(buffer)

    f32[0] = settings.color[0]
    f32[1] = settings.color[1]
    f32[2] = settings.color[2]
    f32[3] = settings.opacity
    f32[4] = settings.hardness
    f32[5] = 0 // pad
    f32[6] = settings.screenSize[0]
    f32[7] = settings.screenSize[1]
    u32[8] = settings.brushShape // 0 or 1
    this.device.queue.writeBuffer(this.uniformBuffer, 0, buffer)

    const encoder = this.device.createCommandEncoder()

    // Select pipeline based on mode
    const pipeline = settings.isErasing
      ? this.erasePipeline
      : this.compositePipeline

    const bindGroup0 = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.currentStrokeTexture.createView() }
      ]
    })

    // Bind Group 1: Uniforms (for brushOpacity)
    const bindGroup1 = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    })

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup0)
    pass.setBindGroup(1, bindGroup1)
    pass.draw(3)
    pass.end()

    this.device.queue.submit([encoder.finish()])
  }

  // Legacy direct render (still useful for single dots or non-accumulating tools)
  public renderStroke(
    targetView: GPUTextureView,
    points: { x: number; y: number; pressure: number }[],
    settings: {
      size: number
      opacity: number
      hardness: number
      color: [number, number, number]
      width: number
      height: number
      brushShape: number
    }
  ) {
    this.renderStrokeInternal(targetView, this.renderPipeline, points, settings)
  }

  private renderStrokeInternal(
    targetView: GPUTextureView,
    pipeline: GPURenderPipeline,
    points: { x: number; y: number; pressure: number }[],
    settings: {
      size: number
      opacity: number
      hardness: number
      color: [number, number, number]
      width: number
      height: number
      brushShape: number
    }
  ) {
    if (points.length === 0) return

    // 1. Update Uniforms
    const buffer = new ArrayBuffer(UNIFORM_SIZE)
    const f32 = new Float32Array(buffer)
    const u32 = new Uint32Array(buffer)

    f32[0] = settings.color[0]
    f32[1] = settings.color[1]
    f32[2] = settings.color[2]
    f32[3] = settings.opacity
    f32[4] = settings.hardness
    f32[5] = 0 // pad
    f32[6] = settings.width
    f32[7] = settings.height
    u32[8] = settings.brushShape
    this.device.queue.writeBuffer(this.uniformBuffer, 0, buffer)

    // 2. Batch Instance Data
    const batchSize = Math.min(points.length, MAX_STROKES)
    const iData = new Float32Array(batchSize * 4)
    for (let i = 0; i < batchSize; i++) {
      iData[i * 4 + 0] = points[i].x
      iData[i * 4 + 1] = points[i].y
      iData[i * 4 + 2] = settings.size
      iData[i * 4 + 3] = points[i].pressure
    }
    this.device.queue.writeBuffer(this.instanceBuffer, 0, iData)

    // 3. Render Pass
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    })

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, this.uniformBindGroup)
    pass.setVertexBuffer(0, this.quadVertexBuffer)
    pass.setVertexBuffer(1, this.instanceBuffer)
    pass.setIndexBuffer(this.indexBuffer, 'uint16')
    pass.drawIndexed(6, batchSize)
    pass.end()

    this.device.queue.submit([encoder.finish()])
  }

  // Blit the stroke accumulator to preview canvas with correct opacity and blend mode
  public blitToCanvas(
    destinationCtx: GPUCanvasContext,
    settings: {
      opacity: number
      color: [number, number, number]
      hardness: number
      screenSize: [number, number]
      brushShape: number
      isErasing?: boolean
    },
    backgroundTexture?: GPUTexture
  ) {
    const encoder = this.device.createCommandEncoder()
    const destView = destinationCtx.getCurrentTexture().createView()

    if (backgroundTexture) {
      // 1a. Draw Background Texture (Copy current state to preview)
      // This is needed for Eraser to show "erasing" effect on existing content
      const bindGroup = this.device.createBindGroup({
        layout: this.blitPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: backgroundTexture.createView() }]
      })

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: destView,
            loadOp: 'clear', // Clear before drawing background
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'store'
          }
        ]
      })
      pass.setPipeline(this.blitPipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(3)
      pass.end()
    } else {
      // 1b. Clear the destination (Standard behavior)
      const clearPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: destView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'store'
          }
        ]
      })
      clearPass.end()
    }

    // 2. Draw Current Stroke Accumulator with correct opacity and blend mode
    if (this.currentStrokeTexture) {
      // Update uniforms for preview pass (apply user's opacity)
      const buffer = new ArrayBuffer(UNIFORM_SIZE)
      const f32 = new Float32Array(buffer)
      const u32 = new Uint32Array(buffer)

      f32[0] = settings.color[0]
      f32[1] = settings.color[1]
      f32[2] = settings.color[2]
      f32[3] = settings.opacity
      f32[4] = settings.hardness
      f32[5] = 0 // pad
      f32[6] = settings.screenSize[0]
      f32[7] = settings.screenSize[1]
      u32[8] = settings.brushShape
      this.device.queue.writeBuffer(this.uniformBuffer, 0, buffer)

      // Select pipeline based on mode (composite for painting, erase for erasing)
      // Use PREVIEW pipelines which are configured with the presentation format
      const pipeline = settings.isErasing
        ? this.erasePipelinePreview
        : this.compositePipelinePreview

      const bindGroup0 = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.currentStrokeTexture.createView() }
        ]
      })

      const bindGroup1 = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
      })

      const passStroke = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: destView,
            loadOp: 'load', // Load the background we just drew (or cleared)
            storeOp: 'store'
          }
        ]
      })
      passStroke.setPipeline(pipeline)
      passStroke.setBindGroup(0, bindGroup0)
      passStroke.setBindGroup(1, bindGroup1)
      passStroke.draw(3)
      passStroke.end()
    }

    this.device.queue.submit([encoder.finish()])
  }

  // Fix: Clear the preview canvas
  public clearPreview(destinationCtx: GPUCanvasContext) {
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: destinationCtx.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store'
        }
      ]
    })
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  public prepareReadback(texture: GPUTexture, outputBuffer: GPUBuffer) {
    const bindGroup = this.device.createBindGroup({
      layout: this.readbackPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: { buffer: outputBuffer } }
      ]
    })

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(this.readbackPipeline)
    pass.setBindGroup(0, bindGroup)

    const width = texture.width
    const height = texture.height
    // Workgroup size is 8x8
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8))
    pass.end()

    this.device.queue.submit([encoder.finish()])
  }

  public destroy() {
    this.quadVertexBuffer.destroy()
    this.indexBuffer.destroy()
    this.instanceBuffer.destroy()
    this.uniformBuffer.destroy()
    if (this.currentStrokeTexture) this.currentStrokeTexture.destroy()
  }
}
