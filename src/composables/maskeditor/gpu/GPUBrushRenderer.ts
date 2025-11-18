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

  // Shaders & Pipeline
  private vertexModule: GPUShaderModule
  private fragmentModule: GPUShaderModule
  private uniformBindGroupLayout: GPUBindGroupLayout
  private uniformBindGroup: GPUBindGroup
  private pipelineLayout: GPUPipelineLayout
  private renderPipeline: GPURenderPipeline

  constructor(device: GPUDevice) {
    this.device = device

    // Create raw buffers
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

    // WGSL Shaders
    const vertexCode = `
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
  let ndcX = (pixelPos.x / globals.screenSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - ((pixelPos.y / globals.screenSize.y) * 2.0);
  return VertexOutput(
    vec4<f32>(ndcX, ndcY, 0.0, 1.0),
    quadPos,
    globals.brushColor,
    pressure,
    globals.hardness
  );
}
`

    const fragmentCode = `
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
  let edge = 1.0 - (v.hardness * 0.5);
  let alphaShape = 1.0 - smoothstep(edge - 0.1, 1.0, dist);
  return vec4<f32>(v.color, alphaShape * v.opacity);
}
`

    this.vertexModule = device.createShaderModule({ code: vertexCode })
    this.fragmentModule = device.createShaderModule({ code: fragmentCode })

    // Bind group layout
    this.uniformBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    })

    this.uniformBindGroup = device.createBindGroup({
      layout: this.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        }
      ]
    })

    this.pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.uniformBindGroupLayout]
    })

    // Render pipeline
    this.renderPipeline = device.createRenderPipeline({
      layout: this.pipelineLayout,
      vertex: {
        module: this.vertexModule,
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
              { shaderLocation: 1, offset: 0, format: 'float32x2' }, // pos @loc1
              { shaderLocation: 2, offset: 8, format: 'float32' }, // size @loc2
              { shaderLocation: 3, offset: 12, format: 'float32' } // pressure @loc3
            ]
          }
        ]
      },
      fragment: {
        module: this.fragmentModule,
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba8unorm',
            blend: {
              color: {
                srcFactor: 'src-alpha',
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
    if (points.length === 0 || points.length > MAX_STROKES) return

    // Write uniform
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

    // Write instance data
    const iData = new Float32Array(points.length * 4)
    for (let i = 0; i < points.length; i++) {
      iData[i * 4 + 0] = points[i].x
      iData[i * 4 + 1] = points[i].y
      iData[i * 4 + 2] = settings.size
      iData[i * 4 + 3] = points[i].pressure
    }
    this.device.queue.writeBuffer(this.instanceBuffer, 0, iData)

    const encoder = this.device.createCommandEncoder()

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    })

    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, this.uniformBindGroup)
    renderPass.setVertexBuffer(0, this.quadVertexBuffer)
    renderPass.setVertexBuffer(1, this.instanceBuffer)
    renderPass.setIndexBuffer(this.indexBuffer, 'uint16')
    renderPass.drawIndexed(6, points.length)
    renderPass.end()

    this.device.queue.submit([encoder.finish()])
  }

  public destroy() {
    this.quadVertexBuffer.destroy()
    this.indexBuffer.destroy()
    this.instanceBuffer.destroy()
    this.uniformBuffer.destroy()
    // Modules and layouts are auto-cleaned
  }

  public getTempTexture() {
    throw new Error('No temp texture, use direct render')
  }
}
