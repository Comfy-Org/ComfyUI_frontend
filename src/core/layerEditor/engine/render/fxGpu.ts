import type { LayerFxData } from './layerFx'
import { blurBoxRadii, gaussianIsNoop } from './layerFx'
import type { Bitmap } from './place'

const VERT = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 v[3] = vec2[](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  v_uv = v[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}`

const FRAG_COPY = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform bool u_flip;
in vec2 v_uv;
out vec4 o;
void main(){ o = texture(u_tex, vec2(v_uv.x, u_flip ? 1.0 - v_uv.y : v_uv.y)); }`

const FRAG_BLUR = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform int u_radius;
in vec2 v_uv;
out vec4 o;
void main(){
  vec4 acc = vec4(0.0);
  for (int i = -u_radius; i <= u_radius; i++) {
    vec4 s = texture(u_tex, v_uv + u_dir * float(i));
    acc += vec4(s.rgb * s.a, s.a);
  }
  acc /= float(2 * u_radius + 1);
  o = vec4(acc.a > 1e-5 ? acc.rgb / acc.a : vec3(0.0), acc.a);
}`

const FRAG_SHADOW_MAKE = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec3 u_color;
uniform float u_so;
in vec2 v_uv;
out vec4 o;
void main(){ o = vec4(u_color, texture(u_tex, v_uv).a * u_so); }`

const FRAG_SHADOW_COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D u_fg;
uniform sampler2D u_shadow;
uniform vec2 u_offset;
in vec2 v_uv;
out vec4 o;
void main(){
  vec2 suv = v_uv - u_offset;
  vec4 sh = (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) ? vec4(0.0) : texture(u_shadow, suv);
  vec4 fg = texture(u_fg, v_uv);
  float outA = fg.a + sh.a * (1.0 - fg.a);
  vec3 rgb = outA > 1e-5 ? (fg.rgb * fg.a + sh.rgb * sh.a * (1.0 - fg.a)) / outA : vec3(0.0);
  o = vec4(rgb, outA);
}`

const FRAG_UNSHARP = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_blur;
uniform float u_scale;
in vec2 v_uv;
out vec4 o;
void main(){
  vec4 s = texture(u_tex, v_uv);
  vec4 b = texture(u_blur, v_uv);
  o = vec4(clamp(s.rgb + (s.rgb - b.rgb) * u_scale, 0.0, 1.0), s.a);
}`

const FRAG_MIX = `#version 300 es
precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_t;
in vec2 v_uv;
out vec4 o;
void main(){
  vec4 a = texture(u_a, v_uv);
  vec4 b = texture(u_b, v_uv);
  vec4 m = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), u_t);
  o = vec4(m.a > 1e-5 ? m.rgb / m.a : vec3(0.0), m.a);
}`

const FRAG_POINT = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform int u_op;
uniform vec2 u_size;
uniform vec4 u_p;
in vec2 v_uv;
out vec4 o;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float lumaOf(vec2 uv){
  vec3 c = texture(u_tex, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  return dot(c, vec3(0.2126, 0.7152, 0.0722)) * 255.0;
}

void main(){
  vec4 s = texture(u_tex, v_uv);
  if (u_op == 0) {
    vec2 px = v_uv * u_size;
    vec2 c = u_size * 0.5;
    float scale = 1.0 / (0.5 * length(u_size));
    vec2 d2 = (px - c) * scale;
    float d = length(d2);
    float v = clamp((u_p.x - d) / max(u_p.y, 0.001), 0.0, 1.0);
    v = pow(v, max(u_p.z, 0.01));
    o = vec4(s.rgb * v, s.a);
  } else if (u_op == 1) {
    if (s.a <= 0.0) { o = s; return; }
    float n = (hash(floor(v_uv * u_size)) - 0.5) * u_p.x;
    o = vec4(clamp(s.rgb + n, 0.0, 1.0), s.a);
  } else if (u_op == 2) {
    float l = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    o = vec4(mix(s.rgb, vec3(l), u_p.x), s.a);
  } else if (u_op == 3) {
    float sz = max(2.0, u_p.x);
    vec2 px = floor(v_uv * u_size / sz) * sz + sz * 0.5;
    o = texture(u_tex, clamp(px / u_size, vec2(0.0), vec2(1.0)));
  } else {
    vec2 e = 1.0 / u_size;
    float nx = lumaOf(v_uv - vec2(e.x, 0.0)) - lumaOf(v_uv + vec2(e.x, 0.0));
    float ny = lumaOf(v_uv - vec2(0.0, e.y)) - lumaOf(v_uv + vec2(0.0, e.y));
    float nz = (6.0 * 255.0) / max(u_p.z, 1.0);
    float az = radians(u_p.x);
    float el = radians(u_p.y);
    vec3 l = vec3(cos(az) * cos(el), sin(az) * cos(el), sin(el));
    float shade = (nx * l.x + ny * l.y + nz * l.z) / length(vec3(nx, ny, nz));
    shade = clamp(shade, 0.0, 1.0);
    o = vec4(vec3(shade), s.a);
  }
}`

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
}

interface FxGpu {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement | OffscreenCanvas
  progs: Record<string, WebGLProgram>
  targets: Target[]
  targetSize: { w: number; h: number }
  srcTex: WebGLTexture
  staging: HTMLCanvasElement
}

let instance: FxGpu | null | undefined

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string
): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'fx shader compile failed')
  }
  return sh
}

function makeProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fragSrc: string
): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? 'fx program link failed')
  }
  return p
}

function setup(): FxGpu | null {
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : document.createElement('canvas')
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    }) as WebGL2RenderingContext | null
    if (!gl) return null
    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const progs = {
      copy: makeProgram(gl, vs, FRAG_COPY),
      blur: makeProgram(gl, vs, FRAG_BLUR),
      shadowMake: makeProgram(gl, vs, FRAG_SHADOW_MAKE),
      shadowCompose: makeProgram(gl, vs, FRAG_SHADOW_COMPOSE),
      unsharp: makeProgram(gl, vs, FRAG_UNSHARP),
      mix: makeProgram(gl, vs, FRAG_MIX),
      point: makeProgram(gl, vs, FRAG_POINT)
    }
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    const srcTex = gl.createTexture()!
    return {
      gl,
      canvas,
      progs,
      targets: [],
      targetSize: { w: 0, h: 0 },
      srcTex,
      staging: document.createElement('canvas')
    }
  } catch {
    return null
  }
}

function makeTex(
  gl: WebGL2RenderingContext,
  w: number,
  h: number
): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

function ensureTargets(fx: FxGpu, w: number, h: number): void {
  const gl = fx.gl
  if (fx.targetSize.w === w && fx.targetSize.h === h && fx.targets.length === 4)
    return
  for (const t of fx.targets) {
    gl.deleteFramebuffer(t.fbo)
    gl.deleteTexture(t.tex)
  }
  fx.targets = []
  for (let i = 0; i < 4; i++) {
    const tex = makeTex(gl, w, h)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    )
    fx.targets.push({ fbo, tex })
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  fx.targetSize = { w, h }
}

function loc(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  name: string
): WebGLUniformLocation | null {
  return gl.getUniformLocation(prog, name)
}

export function applyLayerFxChainGpu(
  bitmap: Bitmap,
  active: LayerFxData[],
  pad: number
): HTMLCanvasElement | null {
  if (active.some((f) => f.op === 'median-blur')) return null
  if (instance === undefined) instance = setup()
  if (!instance) return null
  const fx = instance
  const gl = fx.gl
  if (gl.isContextLost()) {
    instance = undefined
    return null
  }
  const w = bitmap.width + 2 * pad
  const h = bitmap.height + 2 * pad
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  if (w > maxTex || h > maxTex) return null

  try {
    fx.staging.width = w
    fx.staging.height = h
    const sg = fx.staging.getContext('2d')
    if (!sg) return null
    sg.clearRect(0, 0, w, h)
    sg.drawImage(bitmap, pad, pad)

    if (fx.canvas.width !== w) fx.canvas.width = w
    if (fx.canvas.height !== h) fx.canvas.height = h
    ensureTargets(fx, w, h)
    gl.viewport(0, 0, w, h)

    gl.bindTexture(gl.TEXTURE_2D, fx.srcTex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      fx.staging
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3)
    const bindInput = (
      prog: WebGLProgram,
      name: string,
      tex: WebGLTexture,
      unit: number
    ) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(loc(gl, prog, name), unit)
    }
    const freeTarget = (exclude: WebGLTexture[]): Target => {
      const t = fx.targets.find((c) => !exclude.includes(c.tex))
      if (!t) throw new Error('fx target pool exhausted')
      return t
    }

    let cur: WebGLTexture = fx.srcTex

    const runBlur = (input: WebGLTexture, sigma: number): WebGLTexture => {
      const radii = blurBoxRadii(sigma).map((r) => Math.min(200, r))
      if (!radii.length) return input
      const prog = fx.progs.blur
      gl.useProgram(prog)
      let src = input
      for (const dir of [
        [1 / w, 0],
        [0, 1 / h]
      ] as const) {
        for (const radius of radii) {
          const t = freeTarget([src, input, cur])
          gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
          bindInput(prog, 'u_tex', src, 0)
          gl.uniform2f(loc(gl, prog, 'u_dir'), dir[0], dir[1])
          gl.uniform1i(loc(gl, prog, 'u_radius'), radius)
          draw()
          src = t.tex
        }
      }
      return src
    }

    for (const f of active) {
      const before = cur
      let out: WebGLTexture

      if (f.op === 'gaussian-blur') {
        const sigma = f.params.stdDev ?? 0
        out = sigma > 0 && !gaussianIsNoop(sigma) ? runBlur(cur, sigma) : cur
      } else if (f.op === 'unsharp-mask') {
        const usmSigma = Math.max(0.5, f.params.stdDev ?? 3)
        const blurred = gaussianIsNoop(usmSigma) ? cur : runBlur(cur, usmSigma)
        const prog = fx.progs.unsharp
        gl.useProgram(prog)
        const t = freeTarget([cur, blurred])
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        bindInput(prog, 'u_tex', cur, 0)
        bindInput(prog, 'u_blur', blurred, 1)
        gl.uniform1f(loc(gl, prog, 'u_scale'), f.params.scale ?? 0.5)
        draw()
        out = t.tex
      } else if (f.op === 'drop-shadow') {
        const color = f.params.color ?? 0
        let prog = fx.progs.shadowMake
        gl.useProgram(prog)
        const shadowT = freeTarget([cur])
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowT.fbo)
        bindInput(prog, 'u_tex', cur, 0)
        gl.uniform3f(
          loc(gl, prog, 'u_color'),
          ((color >> 16) & 255) / 255,
          ((color >> 8) & 255) / 255,
          (color & 255) / 255
        )
        gl.uniform1f(loc(gl, prog, 'u_so'), f.params.shadowOpacity ?? 0.6)
        draw()
        const blurred =
          (f.params.stdDev ?? 0) > 0 && !gaussianIsNoop(f.params.stdDev)
            ? runBlur(shadowT.tex, f.params.stdDev)
            : shadowT.tex
        prog = fx.progs.shadowCompose
        gl.useProgram(prog)
        const t = freeTarget([cur, blurred])
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        bindInput(prog, 'u_fg', cur, 0)
        bindInput(prog, 'u_shadow', blurred, 1)
        gl.uniform2f(
          loc(gl, prog, 'u_offset'),
          (f.params.x ?? 0) / w,
          (f.params.y ?? 0) / h
        )
        draw()
        out = t.tex
      } else {
        const OP = {
          vignette: 0,
          noise: 1,
          desaturate: 2,
          pixelate: 3,
          emboss: 4
        } as const
        const prog = fx.progs.point
        gl.useProgram(prog)
        const t = freeTarget([cur])
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        bindInput(prog, 'u_tex', cur, 0)
        gl.uniform1i(loc(gl, prog, 'u_op'), OP[f.op as keyof typeof OP] ?? 0)
        gl.uniform2f(loc(gl, prog, 'u_size'), w, h)
        const p = f.params
        const packed =
          f.op === 'vignette'
            ? [
                p.radius ?? 1.2,
                Math.max(0.001, p.softness ?? 0.8),
                Math.max(0.01, p.gamma ?? 1),
                0
              ]
            : f.op === 'noise'
              ? [p.amount ?? 0.2, 0, 0, 0]
              : f.op === 'desaturate'
                ? [Math.max(0, Math.min(1, p.amount ?? 1)), 0, 0, 0]
                : f.op === 'pixelate'
                  ? [Math.max(2, Math.round(p.size ?? 8)), 0, 0, 0]
                  : [
                      p.azimuth ?? 30,
                      p.elevation ?? 45,
                      Math.max(1, p.depth ?? 20),
                      0
                    ]
        gl.uniform4f(
          loc(gl, prog, 'u_p'),
          packed[0],
          packed[1],
          packed[2],
          packed[3]
        )
        draw()
        out = t.tex
      }

      if (f.opacity < 1 && out !== before) {
        const prog = fx.progs.mix
        gl.useProgram(prog)
        const t = freeTarget([before, out])
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        bindInput(prog, 'u_a', before, 0)
        bindInput(prog, 'u_b', out, 1)
        gl.uniform1f(loc(gl, prog, 'u_t'), f.opacity)
        draw()
        out = t.tex
      }
      cur = out
    }

    const prog = fx.progs.copy
    gl.useProgram(prog)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    bindInput(prog, 'u_tex', cur, 0)
    gl.uniform1i(loc(gl, prog, 'u_flip'), 1)
    draw()

    const result = document.createElement('canvas')
    result.width = w
    result.height = h
    const rg = result.getContext('2d')
    if (!rg) return null
    rg.drawImage(fx.canvas, 0, 0)
    return result
  } catch {
    try {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      // context already lost; nothing to release
    }
    instance = null
    return null
  }
}

export function fxGpuAvailable(): boolean {
  if (instance === undefined) instance = setup()
  return !!instance
}
