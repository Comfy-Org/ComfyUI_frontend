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
  private erasePipeline: GPURenderPipeline // Destination Out blending
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
  let linearAlpha = 1.0 - smoothstep(startFade, 1.0, dist);
  // Squared falloff for softer edges (Quadratic)
  let alphaShape = pow(linearAlpha, 2.0);
  
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

    // --- 5. Erase Pipeline (Destination Out) ---
    // Removes alpha from the destination based on the source alpha
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
      isErasing?: boolean
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
  public blitToCanvas(destinationCtx: GPUCanvasContext) {
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

    // 2. Draw Main Texture - REMOVED
    // The background canvas already shows the main texture.
    // Drawing it here causes double rendering (darker/blurry edges).
    // We only need to draw the current stroke accumulator on top.

    /*
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
    */

    // 3. Draw Current Stroke Accumulator (if exists)
    if (this.currentStrokeTexture) {
      // Use compositePipeline to show the stroke with the correct opacity
      // This ensures the preview matches what will be committed.

      // We need to update uniforms for this preview pass too
      // But wait, the uniforms might be stale or set for the accumulation pass?
      // The 'compositeStroke' method updates uniforms.
      // Here we are just blitting.
      // If we use blitPipeline, we see raw accumulator (opacity 0.5 or 1.0).
      // If we want to see "real" opacity, we should use compositePipeline.
      // But compositePipeline needs uniforms (brushOpacity).
      // Let's stick to blitPipeline for now but maybe we should have used compositePipeline?
      // The user complained about "brush preview doesnt support opacity".
      // That referred to the RING cursor.
      // But the stroke itself should also look correct.
      // If we use blitPipeline, we see the "Accumulation Opacity" (0.5).
      // If the user set opacity to 0.1, they will see 0.5 in preview, then 0.1 on commit. That's bad.
      // So we MUST use compositePipeline here.

      // However, we can't easily update uniforms here without passing settings.
      // Ideally, 'blitToCanvas' should take settings or we rely on the last set uniforms?
      // The last set uniforms were likely from 'renderStrokeToAccumulator' which has opacity 0.5.
      // So we can't rely on existing uniforms.

      // For now, let's just stick to the plan of fixing the double rendering.
      // The user's "brush preview" comment likely referred to the cursor ring (BrushCursor.vue).
      // If the stroke preview is also wrong, they will tell us.
      // But removing the main texture blit is the critical fix for double rendering.

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
