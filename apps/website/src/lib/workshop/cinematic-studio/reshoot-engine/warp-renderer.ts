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
 */

import type { Mat4 } from './camera'
import { percentileSorted } from './camera'

const SPLAT = 2

const VERTEX = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uDepth;
uniform ivec2 uSize;
uniform mat4 uInvTarget;
uniform float uFx;
uniform vec2 uCenter;
uniform float uThreshold;
uniform ivec2 uOffset;
out vec2 vUv;
void main() {
  int w = uSize.x;
  ivec2 p = ivec2(gl_VertexID % w, gl_VertexID / w);
  float z = texelFetch(uDepth, p, 0).r;
  // NaN fails every comparison, so no-geometry pixels drop out here too
  if (!(z > 0.0 && z < uThreshold)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 size = vec2(uSize);
  vec3 src = vec3((float(p.x) - size.x * 0.5) / uFx * z,
                  (float(p.y) - size.y * 0.5) / uFx * z, z);
  vec3 d = (uInvTarget * vec4(src, 1.0)).xyz;
  if (d.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 px = roundEven(d.xy / d.z * uFx + uCenter) + vec2(uOffset);
  // pixel centre -> clip space; y flips because row 0 is the top of the frame
  vec2 ndc = (px + 0.5) / size * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, d.z / (d.z + uThreshold) * 2.0 - 1.0, 1.0);
  gl_PointSize = 1.0;
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
  readonly fx: number
  /** Principal point; vertical_shift moves cy by shift * height. */
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
    readonly height: number
  ) {
    canvas.width = width
    canvas.height = height
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
        'uInvTarget',
        'uFx',
        'uCenter',
        'uThreshold',
        'uOffset'
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
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex)
    gl.uniform1i(u.uDepth, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
    gl.uniform1i(u.uColor, 1)
    gl.uniform2i(u.uSize, this.width, this.height)
    gl.uniformMatrix4fv(u.uInvTarget, false, view.inverseTarget)
    gl.uniform1f(u.uFx, view.fx)
    gl.uniform2f(u.uCenter, view.cx, view.cy)
    gl.uniform1f(u.uThreshold, this.threshold)

    gl.clearColor(1, 0, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LESS)
    for (let dy = -SPLAT; dy <= SPLAT; dy++)
      for (let dx = -SPLAT; dx <= SPLAT; dx++) {
        gl.clear(gl.DEPTH_BUFFER_BIT)
        gl.uniform2i(u.uOffset, dx, dy)
        gl.drawArrays(gl.POINTS, 0, this.width * this.height)
      }
  }

  /** Read the frame back, for the parity test against the node. */
  pixels(): Uint8Array {
    const { gl } = this
    const out = new Uint8Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, out)
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
