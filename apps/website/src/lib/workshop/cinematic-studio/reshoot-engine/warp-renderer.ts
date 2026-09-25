/**
 * The CrossView warp, drawn by the GPU: _warp_frame from the node pack in
 * WebGL2, so the preview answers a drag in one frame instead of a server trip.
 *
 * Every source pixel is back-projected with its metric depth, moved into the
 * target camera and re-projected. The node then paints 5x5 splats in 25
 * passes, one per offset, each pass far-to-near over every point: within a
 * pass the nearest point wins, and a later pass overwrites an earlier one.
 * Clearing the depth buffer between passes reproduces exactly that. What the
 * source camera never saw stays magenta, the colour the LoRA was trained on.
 *
 * The points come from the analysis's preview-sized depth, but they can be
 * drawn onto a larger canvas, the size of the output. There the node's 25
 * passes would leave a hatched pattern (points no longer land one per pixel,
 * and the last pass wins), so each point is drawn once as a square just wide
 * enough to meet its neighbours, and the depth test keeps the nearest. At the
 * source's own size the node's passes run as they are: the parity test.
 */

import type { Mat4 } from './camera'
import { percentileSorted } from './camera'

const SPLAT = 2

const VERTEX = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uDepth;
uniform ivec2 uSize;
uniform ivec2 uOutSize;
uniform mat4 uInvTarget;
uniform float uSrcFx;
uniform float uFx;
uniform vec2 uCenter;
uniform float uThreshold;
uniform ivec2 uOffset;
uniform float uPointSize;
out vec2 vUv;
void main() {
  int w = uSize.x;
  ivec2 p = ivec2(gl_VertexID % w, gl_VertexID / w);
  float z = texelFetch(uDepth, p, 0).r;
  // NaN fails every comparison, so no-geometry pixels drop out here too
  if (!(z > 0.0 && z < uThreshold)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 size = vec2(uSize);
  vec3 src = vec3((float(p.x) - size.x * 0.5) / uSrcFx * z,
                  (float(p.y) - size.y * 0.5) / uSrcFx * z, z);
  vec3 d = (uInvTarget * vec4(src, 1.0)).xyz;
  if (d.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 px = roundEven(d.xy / d.z * uFx + uCenter) + vec2(uOffset);
  // pixel centre -> clip space; y flips because row 0 is the top of the frame
  vec2 ndc = (px + 0.5) / vec2(uOutSize) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, d.z / (d.z + uThreshold) * 2.0 - 1.0, 1.0);
  gl_PointSize = uPointSize;
  vUv = (vec2(p) + 0.5) / size;
}`

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uColor;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = vec4(texture(uColor, vUv).rgb, 1.0); }`

export interface WarpView {
  /** Camera-to-world pose of the target camera. */
  readonly inverseTarget: Mat4
  /** Focal length in output pixels. */
  readonly fx: number
  /** Focal length in source pixels; the output's when the two are one size. */
  readonly sourceFx?: number
  /** Principal point in output pixels; vertical_shift moves cy by shift * height. */
  readonly cx: number
  readonly cy: number
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed')
  return shader
}

export class WarpRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly depthTex: WebGLTexture
  private readonly colorTex: WebGLTexture
  private readonly uniforms: Record<string, WebGLUniformLocation | null>
  private threshold = 0
  private readonly vao: WebGLVertexArrayObject

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly width: number,
    readonly height: number,
    /** The size drawn at; the source's own when left out. */
    readonly outWidth = width,
    readonly outHeight = height
  ) {
    canvas.width = outWidth
    canvas.height = outHeight
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: true
    })
    if (!gl) throw new Error('This browser has no WebGL2.')
    this.gl = gl
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? 'link failed')
    this.program = program
    this.vao = gl.createVertexArray()!
    this.uniforms = Object.fromEntries(
      [
        'uDepth',
        'uColor',
        'uSize',
        'uOutSize',
        'uInvTarget',
        'uSrcFx',
        'uFx',
        'uCenter',
        'uThreshold',
        'uOffset',
        'uPointSize'
      ].map((name) => [name, gl.getUniformLocation(program, name)])
    )
    this.depthTex = this.texture()
    this.colorTex = this.texture()
  }

  private texture() {
    const { gl } = this
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  /** Load one frame: its colours and its depth (half floats, metres). */
  setFrame(image: ImageBitmap, depthHalf: Uint16Array, depth: Float32Array) {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R16F,
      this.width,
      this.height,
      0,
      gl.RED,
      gl.HALF_FLOAT,
      depthHalf
    )
    // _warp_frame drops the farthest 0.5% of each frame before splatting
    const finite = depth.filter((z) => Number.isFinite(z) && z > 0).sort()
    this.threshold = percentileSorted(finite, 99.5)
  }

  render(view: WarpView) {
    const { gl, uniforms: u } = this
    gl.viewport(0, 0, this.outWidth, this.outHeight)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex)
    gl.uniform1i(u.uDepth, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
    gl.uniform1i(u.uColor, 1)
    gl.uniform2i(u.uSize, this.width, this.height)
    gl.uniform2i(u.uOutSize, this.outWidth, this.outHeight)
    gl.uniformMatrix4fv(u.uInvTarget, false, view.inverseTarget)
    gl.uniform1f(u.uSrcFx, view.sourceFx ?? view.fx)
    gl.uniform1f(u.uFx, view.fx)
    gl.uniform2f(u.uCenter, view.cx, view.cy)
    gl.uniform1f(u.uThreshold, this.threshold)

    gl.clearColor(1, 0, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LESS)
    const points = this.width * this.height
    if (this.outWidth === this.width) {
      gl.uniform1f(u.uPointSize, 1)
      for (let dy = -SPLAT; dy <= SPLAT; dy++)
        for (let dx = -SPLAT; dx <= SPLAT; dx++) {
          gl.clear(gl.DEPTH_BUFFER_BIT)
          gl.uniform2i(u.uOffset, dx, dy)
          gl.drawArrays(gl.POINTS, 0, points)
        }
      return
    }
    gl.clear(gl.DEPTH_BUFFER_BIT)
    gl.uniform2i(u.uOffset, 0, 0)
    gl.uniform1f(u.uPointSize, Math.ceil(this.outWidth / this.width) + 1)
    gl.drawArrays(gl.POINTS, 0, points)
  }

  /** Read the frame back, for the parity test against the node. */
  pixels(): Uint8Array {
    const { gl } = this
    const out = new Uint8Array(this.outWidth * this.outHeight * 4)
    gl.readPixels(
      0,
      0,
      this.outWidth,
      this.outHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      out
    )
    return out
  }

  dispose() {
    const { gl } = this
    gl.deleteTexture(this.depthTex)
    gl.deleteTexture(this.colorTex)
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
  }
}
