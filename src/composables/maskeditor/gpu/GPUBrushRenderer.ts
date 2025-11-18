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
  private renderPipeline: GPURenderPipeline
  private blitPipeline: GPURenderPipeline
  private uniformBindGroup: GPUBindGroup

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
  let radius = (size * pressure) / 2.0;
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
  
  // Fix: Output Premultiplied Alpha
  // This prevents "Black Glow" artifacts when blending semi-transparent colors.
  // Standard compositing expects (r*a, g*a, b*a, a).
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
              // Fix: Premultiplied Alpha Blending
              // Src * 1 + Dst * (1 - SrcAlpha)
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
  }

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

    pass.setPipeline(this.renderPipeline)
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

    // Dynamic BindGroup for the source texture
    const bindGroup = this.device.createBindGroup({
      layout: this.blitPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: sourceTexture.createView() }]
    })

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

    pass.setPipeline(this.blitPipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()

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
  }
}
