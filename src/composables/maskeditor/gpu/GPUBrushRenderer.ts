import * as d from 'typegpu/data'
import { BrushUniforms, StrokePoint } from './gpuSchema'

const QUAD_VERTS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3])

const UNIFORM_SIZE = d.sizeOf(BrushUniforms) // 32
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
  private uniformBindGroup: GPUBindGroup

  // Textures
  private currentStrokeTexture: GPUTexture | null = null
  private currentStrokeView: GPUTextureView | null = null

  constructor(device: GPUDevice) {
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
    const brushVertex = `
struct BrushUniforms {
  brushColor: vec3<f32>,
  brushOpacity: f32,
  hardness: f32,
  pad: f32,
  screenSize: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localUV: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) opacity: f32,
  @location(3) hardness: f32,
};

@group(0) @binding(0) var<uniform> globals: BrushUniforms;

@vertex
fn vs(
  @location(0) quadPos: vec2<f32>,
  @location(1) pos: vec2<f32>,
  @location(2) size: f32,
  @location(3) pressure: f32
) -> VertexOutput {
  // Treat 'size' as radius to match the cursor implementation (diameter = 2 * size)
  let radius = (size * pressure);
  let pixelPos = pos + (quadPos * radius);
  
  // Convert Pixel Space -> NDC
  let ndcX = (pixelPos.x / globals.screenSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - ((pixelPos.y / globals.screenSize.y) * 2.0); // Flip Y

  return VertexOutput(
    vec4<f32>(ndcX, ndcY, 0.0, 1.0),
    quadPos,
    globals.brushColor,
    pressure * globals.brushOpacity,
    globals.hardness
  );
}
`

    const brushFragment = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localUV: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) opacity: f32,
  @location(3) hardness: f32,
};

@fragment
fn fs(v: VertexOutput) -> @location(0) vec4<f32> {
  let dist = length(v.localUV);
  if (dist > 1.0) { discard; }

  // Correct Hardness Math:
  // Hardness 1.0 -> smoothstep(1.0, 1.0, dist) -> Sharp step at 1.0
  // Hardness 0.0 -> smoothstep(0.0, 1.0, dist) -> Linear fade from 0.0
  // 1.0 - smoothstep(...) inverts it so 1.0 is center, 0.0 is edge.
  
  let startFade = v.hardness * 0.99; // Prevent 1.0 singularity
  let alphaShape = 1.0 - smoothstep(startFade, 1.0, dist);
  
  // Output Premultiplied Alpha
  let alpha = alphaShape * v.opacity;
  return vec4<f32>(v.color * alpha, alpha);
}
`

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
    const blitShader = `
      @vertex fn vs(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
        );
        return vec4<f32>(pos[vIdx], 0.0, 1.0);
      }
      
      @group(0) @binding(0) var myTexture: texture_2d<f32>;
      
      @fragment fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
        return textureLoad(myTexture, vec2<i32>(pos.xy), 0);
      }
    `

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
            format: navigator.gpu.getPreferredCanvasFormat(),
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
    const compositeShader = `
      struct BrushUniforms {
        brushColor: vec3<f32>,
        brushOpacity: f32,
        hardness: f32,
        pad: f32,
        screenSize: vec2<f32>,
      };

      @vertex fn vs(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
        );
        return vec4<f32>(pos[vIdx], 0.0, 1.0);
      }
      
      @group(0) @binding(0) var myTexture: texture_2d<f32>;
      @group(1) @binding(0) var<uniform> globals: BrushUniforms;
      
      @fragment fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
        let sampled = textureLoad(myTexture, vec2<i32>(pos.xy), 0);
        // Scale the accumulated coverage by the global brush opacity
        return sampled * globals.brushOpacity;
      }
    `

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
    }
  ) {
    if (!this.currentStrokeTexture) return

    // Update Uniforms for Composite Pass (specifically Opacity)
    const uData = new Float32Array(UNIFORM_SIZE / 4)
    uData[0] = settings.color[0]
    uData[1] = settings.color[1]
    uData[2] = settings.color[2]
    uData[3] = settings.opacity
    uData[4] = settings.hardness
    uData[5] = 0 // pad
    uData[6] = settings.screenSize[0]
    uData[7] = settings.screenSize[1]
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uData)

    const encoder = this.device.createCommandEncoder()

    const bindGroup0 = this.device.createBindGroup({
      layout: this.compositePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.currentStrokeTexture.createView() }
      ]
    })

    // Bind Group 1: Uniforms (for brushOpacity)
    const bindGroup1 = this.device.createBindGroup({
      layout: this.compositePipeline.getBindGroupLayout(1),
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

    pass.setPipeline(this.compositePipeline)
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
    }
  ) {
    if (points.length === 0) return

    // 1. Update Uniforms
    const uData = new Float32Array(UNIFORM_SIZE / 4)
    uData[0] = settings.color[0]
    uData[1] = settings.color[1]
    uData[2] = settings.color[2]
    uData[3] = settings.opacity
    uData[4] = settings.hardness
    uData[5] = 0 // pad
    uData[6] = settings.width
    uData[7] = settings.height
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uData)

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

  // New: Blit the working texture to a presentation canvas
  public blitToCanvas(
    sourceTexture: GPUTexture,
    destinationCtx: GPUCanvasContext
  ) {
    const encoder = this.device.createCommandEncoder()
    const destView = destinationCtx.getCurrentTexture().createView()

    // 1. Clear the destination first
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

    // 2. Draw Main Texture
    const bindGroupMain = this.device.createBindGroup({
      layout: this.blitPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: sourceTexture.createView() }]
    })

    const passMain = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: destView,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    })
    passMain.setPipeline(this.blitPipeline)
    passMain.setBindGroup(0, bindGroupMain)
    passMain.draw(3)
    passMain.end()

    // 3. Draw Current Stroke Accumulator (if exists)
    if (this.currentStrokeTexture) {
      // Note: We should probably use the composite pipeline here to show the "limited" opacity?
      // But blitPipeline is simpler. If we show the raw accumulator, it might look too bright (1.0).
      // But that's fine for preview.
      const bindGroupStroke = this.device.createBindGroup({
        layout: this.blitPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.currentStrokeTexture.createView() }
        ]
      })

      const passStroke = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: destView,
            loadOp: 'load',
            storeOp: 'store'
          }
        ]
      })
      passStroke.setPipeline(this.blitPipeline)
      passStroke.setBindGroup(0, bindGroupStroke)
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

  public destroy() {
    this.quadVertexBuffer.destroy()
    this.indexBuffer.destroy()
    this.instanceBuffer.destroy()
    this.uniformBuffer.destroy()
    if (this.currentStrokeTexture) this.currentStrokeTexture.destroy()
  }
}
