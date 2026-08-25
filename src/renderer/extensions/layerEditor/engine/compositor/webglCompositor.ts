import type { Rect } from '../node'
import { modeUniforms } from './modeCodes'
import type {
  Compositor,
  CompositeInput,
  CompositorInit,
  FBOHandle,
  NodeTexture
} from '../compositor'
import LAYER_BLEND_FRAG from './shaders/layerBlend.frag?raw'

const VERT = `#version 300 es
out vec2 v_texCoord;
void main() {
  vec2 v[3] = vec2[](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  v_texCoord = v[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}`

const PRESENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
float lin2srgb(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
void main(){
  vec4 c = texture(u_tex, v_texCoord);
  fragColor = vec4(lin2srgb(c.r), lin2srgb(c.g), lin2srgb(c.b), clamp(c.a, 0.0, 1.0));
}`

const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
void main(){ fragColor = texture(u_tex, v_texCoord); }`

const ADJUST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_backdrop;
uniform sampler2D u_mask;
uniform sampler2D u_lut;
uniform bool u_hasMask;
uniform float u_opacity;
uniform int u_op;
uniform vec4 u_p0;
uniform vec4 u_p1;
uniform vec4 u_p2;
in vec2 v_texCoord;
out vec4 fragColor;

float s2l(float c){ return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float l2s(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
vec3 s2l(vec3 c){ return vec3(s2l(c.r), s2l(c.g), s2l(c.b)); }
vec3 l2s(vec3 c){ return vec3(l2s(c.r), l2s(c.g), l2s(c.b)); }

float bc(float v, float b, float c){
  float hb = b * 0.5;
  float o = hb < 0.0 ? v * (1.0 + hb) : v + (1.0 - v) * hb;
  return (o - 0.5) * tan((c + 1.0) * 0.78539816) + 0.5;
}

vec3 rgb2hsl(vec3 c){
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t){
  float x = t;
  if (x < 0.0) x += 1.0;
  if (x > 1.0) x -= 1.0;
  if (x < 1.0/6.0) return p + (q - p) * 6.0 * x;
  if (x < 0.5) return q;
  if (x < 2.0/3.0) return p + (q - p) * (2.0/3.0 - x) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl){
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(hue2rgb(p, q, hsl.x + 1.0/3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0/3.0));
}

float lev(float v){
  float t = clamp((v - u_p0.x) / max(u_p0.y - u_p0.x, 1e-4), 0.0, 1.0);
  return u_p0.w + pow(t, 1.0 / max(u_p0.z, 1e-4)) * (u_p1.x - u_p0.w);
}

float balComp(float v, float l, float s, float m, float h){
  const float a = 4.0;
  const float b = 0.333;
  const float sc = 0.7;
  float sw = s * clamp((b - l) * a + 0.5, 0.0, 1.0) * sc;
  float mw = m * clamp((l - b) * a + 0.5, 0.0, 1.0) * clamp((1.0 - l - b) * a + 0.5, 0.0, 1.0) * sc;
  float hw = h * clamp((l + b - 1.0) * a + 0.5, 0.0, 1.0) * sc;
  return clamp(v + sw + mw + hw, 0.0, 1.0);
}

float hfun(float n, float h, float s, float l){
  float a = s * min(l, 1.0 - l);
  float k = mod(n + h / 30.0, 12.0);
  return clamp(l - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0), 0.0, 1.0);
}

vec3 preservel(vec3 c, float l){
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float h;
  if (c.r == c.g && c.g == c.b) h = 0.0;
  else if (mx == c.r) h = 60.0 * ((c.g - c.b) / (mx - mn));
  else if (mx == c.g) h = 60.0 * (2.0 + (c.b - c.r) / (mx - mn));
  else h = 60.0 * (4.0 + (c.r - c.g) / (mx - mn));
  if (h < 0.0) h += 360.0;
  float lOut = (mx + mn) * 0.5;
  float denom = 1.0 - abs(2.0 * lOut - 1.0);
  float s = denom <= 1e-6 ? 0.0 : (mx - mn) / denom;
  return vec3(hfun(0.0, h, s, l), hfun(8.0, h, s, l), hfun(4.0, h, s, l));
}

float lutAt(float v, int ch){
  float x = (floor(clamp(v, 0.0, 1.0) * 255.0 + 0.5) + 0.5) / 256.0;
  vec4 s = texture(u_lut, vec2(x, 0.5));
  return ch == 0 ? s.r : ch == 1 ? s.g : s.b;
}

void main(){
  vec4 bg = texture(u_backdrop, v_texCoord);
  vec3 adjusted;
  if (u_op == 0) {
    adjusted = vec3(bc(bg.r, u_p0.x, u_p0.y), bc(bg.g, u_p0.x, u_p0.y), bc(bg.b, u_p0.x, u_p0.y));
  } else if (u_op == 5) {
    adjusted = clamp((bg.rgb - vec3(u_p0.x)) * u_p0.y, 0.0, 1.0);
  } else {
    vec3 g = l2s(clamp(bg.rgb, 0.0, 1.0));
    vec3 o;
    if (u_op == 1) {
      vec3 hsl = rgb2hsl(g);
      hsl.x = fract(hsl.x + u_p0.x + 1.0);
      hsl.y = clamp(hsl.y * (1.0 + u_p0.y), 0.0, 1.0);
      hsl.z = clamp(u_p0.z > 0.0 ? hsl.z + u_p0.z * (1.0 - hsl.z) : hsl.z + u_p0.z * hsl.z, 0.0, 1.0);
      o = hsl2rgb(hsl);
    } else if (u_op == 2) {
      o = vec3(1.0) - g;
    } else if (u_op == 3) {
      o = vec3(lev(g.r), lev(g.g), lev(g.b));
    } else if (u_op == 4) {
      o = mix(g, g * u_p0.xyz, u_p0.w);
    } else if (u_op == 6) {
      float l = (max(g.r, max(g.g, g.b)) + min(g.r, min(g.g, g.b))) * 0.5;
      o = vec3(
        balComp(g.r, l, u_p0.x, u_p0.w, u_p1.z),
        balComp(g.g, l, u_p0.y, u_p1.x, u_p1.w),
        balComp(g.b, l, u_p0.z, u_p1.y, u_p2.x));
      o = preservel(o, l);
    } else if (u_op == 7) {
      float n = max(u_p0.x, 2.0) - 1.0;
      o = floor(g * n + 0.5) / n;
    } else if (u_op == 8) {
      float y = dot(g, vec3(0.2126, 0.7152, 0.0722));
      o = vec3(y >= u_p0.x ? 1.0 : 0.0);
    } else if (u_op == 9) {
      float sat = max(g.r, max(g.g, g.b)) - min(g.r, min(g.g, g.b));
      float luma = g.g * 0.715158 + g.r * 0.212656 + g.b * 0.072186;
      float s = u_p0.x > 0.0 ? 1.0 : -1.0;
      float k = 1.0 + u_p0.x * (1.0 + s * sat);
      o = clamp(vec3(luma) + (g - vec3(luma)) * k, 0.0, 1.0);
    } else {
      o = vec3(lutAt(g.r, 0), lutAt(g.g, 1), lutAt(g.b, 2));
    }
    adjusted = s2l(clamp(o, 0.0, 1.0));
  }
  float t = u_opacity * (u_hasMask ? texture(u_mask, v_texCoord).r : 1.0);
  fragColor = vec4(mix(bg.rgb, adjusted, t), bg.a);
}`

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string
): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'compile failed'
    gl.deleteShader(sh)
    throw new Error(log)
  }
  return sh
}

function link(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? 'link failed'
    gl.deleteProgram(p)
    throw new Error(log)
  }
  return p
}

export function createWebGLCompositor(): Compositor {
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null
  let blendProg: WebGLProgram | null = null
  let presentProg: WebGLProgram | null = null
  let copyProg: WebGLProgram | null = null
  let adjustProg: WebGLProgram | null = null
  let ping: Target | null = null
  let pong: Target | null = null
  let result: Target | null = null
  let resultValid = false
  let scratch2d: HTMLCanvasElement | null = null
  let lastSweepGen = 0
  let fallback: WebGLTexture | null = null
  let lutTex: WebGLTexture | null = null
  let width = 0
  let height = 0
  let nextHandle = 1
  let generation = 0
  let contextLost = false
  let disposed = false
  let lastRecover = -Infinity
  let onRestored: (() => void) | undefined
  const targets = new Map<number, Target>()
  const texCache = new Map<
    string,
    { tex: WebGLTexture; gen: number; version?: number }
  >()
  let uniformCache = new WeakMap<
    WebGLProgram,
    Map<string, WebGLUniformLocation | null>
  >()

  function loc(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = uniformCache.get(prog)
    if (!m) {
      m = new Map()
      uniformCache.set(prog, m)
    }
    if (!m.has(name)) m.set(name, gl!.getUniformLocation(prog, name))
    return m.get(name)!
  }

  function makeTarget(w: number, h: number): Target | null {
    const g = gl!
    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA16F,
      w,
      h,
      0,
      g.RGBA,
      g.HALF_FLOAT,
      null
    )
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const fbo = g.createFramebuffer()!
    g.bindFramebuffer(g.FRAMEBUFFER, fbo)
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      tex,
      0
    )
    const complete =
      g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    if (!complete) {
      g.deleteFramebuffer(fbo)
      g.deleteTexture(tex)
      return null
    }
    return { fbo, tex, width: w, height: h }
  }

  function freeTargetObj(t: Target): void {
    gl?.deleteFramebuffer(t.fbo)
    gl?.deleteTexture(t.tex)
  }

  function drawFullscreen(): void {
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }

  function resolveTexture(
    nt: NodeTexture,
    temps: WebGLTexture[]
  ): WebGLTexture {
    if (nt.source instanceof WebGLTexture) return nt.source
    if (nt.key) {
      const hit = texCache.get(nt.key)
      if (hit) {
        hit.gen = generation
        if (nt.version === undefined || hit.version === nt.version)
          return hit.tex
        if (
          hit.version === nt.version - 1 &&
          nt.dirtyRects &&
          partialUploadAll(hit.tex, nt.source, nt.dirtyRects)
        ) {
          hit.version = nt.version
          return hit.tex
        }
        uploadInto(hit.tex, nt.source)
        hit.version = nt.version
        return hit.tex
      }
      const tex = uploadSource(nt.source)
      texCache.set(nt.key, { tex, gen: generation, version: nt.version })
      return tex
    }
    const tex = uploadSource(nt.source)
    temps.push(tex)
    return tex
  }

  function partialUploadAll(
    tex: WebGLTexture,
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    rects: Rect[]
  ): boolean {
    let area = 0
    for (const r of rects) area += Math.max(0, r.w) * Math.max(0, r.h)
    if (area > (src.width * src.height) / 2) return false
    for (const r of rects) {
      if (!partialUpload(tex, src, r)) return false
    }
    return true
  }

  function partialUpload(
    tex: WebGLTexture,
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    rect: Rect
  ): boolean {
    const g = gl!
    const x = Math.max(0, Math.floor(rect.x))
    const y = Math.max(0, Math.floor(rect.y))
    const w = Math.min(src.width, Math.ceil(rect.x + rect.w)) - x
    const h = Math.min(src.height, Math.ceil(rect.y + rect.h)) - y
    if (w <= 0 || h <= 0) return true
    if (!scratch2d) scratch2d = document.createElement('canvas')
    scratch2d.width = w
    scratch2d.height = h
    const sctx = scratch2d.getContext('2d')
    if (!sctx) return false
    sctx.clearRect(0, 0, w, h)
    sctx.drawImage(src, x, y, w, h, 0, 0, w, h)
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texSubImage2D(
      g.TEXTURE_2D,
      0,
      x,
      src.height - (y + h),
      g.RGBA,
      g.UNSIGNED_BYTE,
      scratch2d
    )
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    return true
  }

  function uploadInto(
    tex: WebGLTexture,
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  ): void {
    const g = gl!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
  }

  function sweepTexCache(): void {
    if (generation - lastSweepGen < 8) return
    lastSweepGen = generation
    for (const [key, entry] of texCache) {
      if (entry.gen < generation - 3) {
        gl?.deleteTexture(entry.tex)
        texCache.delete(key)
      }
    }
  }

  function uploadSource(
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  ): WebGLTexture {
    const g = gl!
    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    return tex
  }

  function getFallback(): WebGLTexture {
    if (!fallback) {
      const g = gl!
      fallback = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, fallback)
      g.texImage2D(
        g.TEXTURE_2D,
        0,
        g.RGBA,
        1,
        1,
        0,
        g.RGBA,
        g.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      )
    }
    return fallback
  }

  function getLutTex(lut?: Uint8Array): WebGLTexture {
    if (!lut) return getFallback()
    const g = gl!
    if (!lutTex) {
      lutTex = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, lutTex)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    } else {
      g.bindTexture(g.TEXTURE_2D, lutTex)
    }
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA,
      256,
      1,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      lut
    )
    return lutTex
  }

  function clearTarget(t: Target): void {
    const g = gl!
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo)
    g.viewport(0, 0, t.width, t.height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
  }

  function dropContextState(): void {
    targets.clear()
    texCache.clear()
    uniformCache = new WeakMap()
    ping = pong = result = null
    resultValid = false
    fallback = null
    lutTex = null
    blendProg = presentProg = copyProg = adjustProg = null
    gl = null
    canvas = null
  }

  function setupContext(): boolean {
    try {
      const c =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(width, height)
          : document.createElement('canvas')
      if (!(c instanceof OffscreenCanvas)) {
        c.width = width
        c.height = height
      }
      const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext(
        'webgl2',
        {
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true
        }
      ) as WebGL2RenderingContext | null
      if (!ctx) return false
      if (!ctx.getExtension('EXT_color_buffer_float')) return false
      canvas = c
      gl = ctx
      contextLost = false
      c.addEventListener('webglcontextlost', (e: Event) => {
        e.preventDefault()
        if (canvas !== c) return
        contextLost = true
        if (disposed) return
        console.warn('[LayerEditor] WebGL context lost — recreating')
        queueMicrotask(() => {
          if (recover()) onRestored?.()
        })
      })
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      blendProg = link(
        gl,
        vs,
        compile(gl, gl.FRAGMENT_SHADER, LAYER_BLEND_FRAG)
      )
      presentProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, PRESENT_FRAG))
      copyProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, COPY_FRAG))
      adjustProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, ADJUST_FRAG))
      ping = makeTarget(width, height)
      pong = makeTarget(width, height)
      return !!ping && !!pong
    } catch {
      dropContextState()
      return false
    }
  }

  function recover(): boolean {
    if (disposed) return false
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now - lastRecover < 1000) return false
    lastRecover = now
    dropContextState()
    return setupContext()
  }

  function ensureHealthy(): boolean {
    if (disposed) return false
    if (gl && !contextLost && !gl.isContextLost()) return true
    contextLost = true
    if (!recover()) return false
    if (onRestored) queueMicrotask(onRestored)
    return true
  }

  return {
    init(opts: CompositorInit): boolean {
      if (gl) {
        if (!gl.isContextLost())
          gl.getExtension('WEBGL_lose_context')?.loseContext()
        dropContextState()
      }
      width = opts.width
      height = opts.height
      onRestored = opts.onContextRestored
      disposed = false
      if (setupContext()) return true
      dropContextState()
      return false
    },

    beginFrame(): void {
      generation += 1
    },

    resize(w: number, h: number): void {
      if (w === width && h === height) return
      width = w
      height = h
      if (!ensureHealthy() || !gl) return
      if (canvas) {
        canvas.width = w
        canvas.height = h
      }
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      if (result) freeTargetObj(result)
      ping = makeTarget(w, h)
      pong = makeTarget(w, h)
      result = null
      resultValid = false
    },

    composite(
      inputs: CompositeInput[],
      target?: FBOHandle | null,
      region?: Rect
    ): void {
      if (!ensureHealthy()) return
      if (!gl || !blendProg || !ping || !pong) return
      const g = gl
      g.disable(g.SCISSOR_TEST)

      let clip: Rect | null = null
      if (!target && region && resultValid && result) {
        const x = Math.max(0, Math.floor(region.x))
        const y = Math.max(0, Math.floor(region.y))
        const w = Math.min(width, Math.ceil(region.x + region.w)) - x
        const h = Math.min(height, Math.ceil(region.y + region.h)) - y
        if (w <= 0 || h <= 0) return
        if (w < width || h < height) clip = { x, y, w, h }
      }
      if (clip) {
        g.enable(g.SCISSOR_TEST)
        g.scissor(clip.x, height - (clip.y + clip.h), clip.w, clip.h)
      }

      let read = ping
      let write = pong
      clearTarget(read)
      const temps: WebGLTexture[] = []

      for (const input of inputs) {
        clearTarget(write)
        g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
        g.viewport(0, 0, write.width, write.height)

        if ('adjust' in input) {
          if (!adjustProg) continue
          g.useProgram(adjustProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(adjustProg, 'u_backdrop'), 0)
          g.activeTexture(g.TEXTURE2)
          g.bindTexture(
            g.TEXTURE_2D,
            input.mask ? resolveTexture(input.mask, temps) : getFallback()
          )
          g.uniform1i(loc(adjustProg, 'u_mask'), 2)
          g.uniform1i(loc(adjustProg, 'u_hasMask'), input.mask ? 1 : 0)
          g.uniform1f(loc(adjustProg, 'u_opacity'), input.opacity)
          g.uniform1i(loc(adjustProg, 'u_op'), input.adjust.op)
          const p = input.adjust.params
          g.uniform4f(
            loc(adjustProg, 'u_p0'),
            p[0] ?? 0,
            p[1] ?? 0,
            p[2] ?? 0,
            p[3] ?? 0
          )
          g.uniform4f(
            loc(adjustProg, 'u_p1'),
            p[4] ?? 0,
            p[5] ?? 0,
            p[6] ?? 0,
            p[7] ?? 0
          )
          g.uniform4f(
            loc(adjustProg, 'u_p2'),
            p[8] ?? 0,
            p[9] ?? 0,
            p[10] ?? 0,
            p[11] ?? 0
          )
          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, getLutTex(input.adjust.lut))
          g.uniform1i(loc(adjustProg, 'u_lut'), 1)
        } else {
          g.useProgram(blendProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(blendProg, 'u_backdrop'), 0)

          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, resolveTexture(input.texture, temps))
          g.uniform1i(loc(blendProg, 'u_layer'), 1)

          g.activeTexture(g.TEXTURE2)
          g.bindTexture(
            g.TEXTURE_2D,
            input.mask ? resolveTexture(input.mask, temps) : getFallback()
          )
          g.uniform1i(loc(blendProg, 'u_mask'), 2)
          g.uniform1i(loc(blendProg, 'u_hasMask'), input.mask ? 1 : 0)

          g.uniform1i(
            loc(blendProg, 'u_srgbLayer'),
            input.texture.linear ? 0 : 1
          )
          g.uniform1f(loc(blendProg, 'u_opacity'), input.opacity)
          const u = modeUniforms(input.mode)
          g.uniform1i(loc(blendProg, 'u_blend'), u.blend)
          g.uniform1i(loc(blendProg, 'u_composite'), u.composite)
          g.uniform1i(loc(blendProg, 'u_blendSpace'), u.blendSpace)
          g.uniform1i(loc(blendProg, 'u_compositeSpace'), u.compositeSpace)
        }

        drawFullscreen()
        const tmp = read
        read = write
        write = tmp
      }

      for (const tex of temps) g.deleteTexture(tex)
      sweepTexCache()

      if (target) {
        const dst = targets.get(target.id)
        if (dst) blit(read, dst)
        return
      }

      if (!result || result.width !== width || result.height !== height) {
        if (result) freeTargetObj(result)
        result = makeTarget(width, height)
        resultValid = false
      }
      if (result) {
        blit(read, result)
        resultValid = true
      }
      if (clip) g.disable(g.SCISSOR_TEST)
    },

    allocTarget(w: number, h: number): FBOHandle {
      const id = nextHandle++
      if (gl) {
        const target = makeTarget(w, h)
        if (target) targets.set(id, target)
      }
      return { id, width: w, height: h }
    },

    freeTarget(handle: FBOHandle): void {
      const t = targets.get(handle.id)
      if (t) {
        freeTargetObj(t)
        targets.delete(handle.id)
      }
    },

    targetTexture(handle: FBOHandle): WebGLTexture | null {
      return targets.get(handle.id)?.tex ?? null
    },

    upload(
      source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas
    ): WebGLTexture {
      return uploadSource(source)
    },

    readback(region?: Rect): ImageData {
      const empty = () => new ImageData(Math.max(1, width), Math.max(1, height))
      if (!ensureHealthy() || !gl || !ping) return empty()
      const g = gl

      let clip: Rect | null = null
      if (region) {
        const x = Math.max(0, Math.floor(region.x))
        const y = Math.max(0, Math.floor(region.y))
        const w = Math.min(width, Math.ceil(region.x + region.w)) - x
        const h = Math.min(height, Math.ceil(region.y + region.h)) - y
        if (w <= 0 || h <= 0) return new ImageData(1, 1)
        if (w < width || h < height) clip = { x, y, w, h }
      }

      presentToDefault(result ?? ping, clip)
      g.bindFramebuffer(g.FRAMEBUFFER, null)
      if (clip) {
        const px = new Uint8ClampedArray(clip.w * clip.h * 4)
        g.readPixels(
          clip.x,
          height - (clip.y + clip.h),
          clip.w,
          clip.h,
          g.RGBA,
          g.UNSIGNED_BYTE,
          px
        )
        flipRows(px, clip.w, clip.h)
        return new ImageData(px, clip.w, clip.h)
      }
      const px = new Uint8ClampedArray(width * height * 4)
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, px)
      flipRows(px, width, height)
      return new ImageData(px, width, height)
    },

    async toBlob(): Promise<Blob> {
      const data = this.readback()
      const c = document.createElement('canvas')
      c.width = data.width
      c.height = data.height
      c.getContext('2d')!.putImageData(data, 0, 0)
      return await new Promise<Blob>((res, rej) =>
        c.toBlob(
          (b) => (b ? res(b) : rej(new Error('toBlob failed'))),
          'image/png'
        )
      )
    },

    getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
      return canvas
    },

    dispose(): void {
      disposed = true
      if (!gl) return
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      if (result) freeTargetObj(result)
      for (const t of targets.values()) freeTargetObj(t)
      targets.clear()
      for (const entry of texCache.values()) gl.deleteTexture(entry.tex)
      texCache.clear()
      if (fallback) gl.deleteTexture(fallback)
      if (lutTex) gl.deleteTexture(lutTex)
      if (blendProg) gl.deleteProgram(blendProg)
      if (presentProg) gl.deleteProgram(presentProg)
      if (copyProg) gl.deleteProgram(copyProg)
      if (adjustProg) gl.deleteProgram(adjustProg)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
      ping = pong = result = null
      lutTex = null
      fallback = blendProg = presentProg = copyProg = adjustProg = null
    }
  }

  function presentToDefault(src: Target, clip?: Rect | null): void {
    const g = gl!
    g.disable(g.SCISSOR_TEST)
    if (clip) {
      g.enable(g.SCISSOR_TEST)
      g.scissor(clip.x, height - (clip.y + clip.h), clip.w, clip.h)
    }
    g.useProgram(presentProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, width, height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(presentProg!, 'u_tex'), 0)
    drawFullscreen()
    if (clip) g.disable(g.SCISSOR_TEST)
  }

  function blit(src: Target, dst: Target): void {
    const g = gl!
    g.useProgram(copyProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, dst.fbo)
    g.viewport(0, 0, dst.width, dst.height)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(copyProg!, 'u_tex'), 0)
    drawFullscreen()
  }
}

function flipRows(px: Uint8ClampedArray, w: number, h: number): void {
  const row = w * 4
  const tmp = new Uint8ClampedArray(row)
  for (let y = 0; y < h >> 1; y++) {
    const top = y * row
    const bot = (h - 1 - y) * row
    tmp.set(px.subarray(top, top + row))
    px.copyWithin(top, bot, bot + row)
    px.set(tmp, bot)
  }
}
