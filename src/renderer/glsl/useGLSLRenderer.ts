import { onScopeDispose } from 'vue'

import { detectOutputCount, detectPassCount } from '@/renderer/glsl/glslUtils'

const VERTEX_SHADER_SOURCE = `#version 300 es
out vec2 v_texCoord;
void main() {
    vec2 verts[3] = vec2[](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
    v_texCoord = verts[gl_VertexID] * 0.5 + 0.5;
    gl_Position = vec4(verts[gl_VertexID], 0, 1);
}
`

const MAX_INPUTS = 5
const MAX_FLOAT_UNIFORMS = 5
const MAX_INT_UNIFORMS = 5
const MAX_PASSES = 32

const UNIFORM_NAMES = [
  'u_resolution',
  'u_pass',
  'u_prevPass',
  ...Array.from({ length: MAX_INPUTS }, (_, i) => `u_image${i}`),
  ...Array.from({ length: MAX_FLOAT_UNIFORMS }, (_, i) => `u_float${i}`),
  ...Array.from({ length: MAX_INT_UNIFORMS }, (_, i) => `u_int${i}`)
]

interface CompileResult {
  success: boolean
  log: string
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Compilation failed'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}

function flipVertically(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const rowSize = width * 4
  const temp = new Uint8ClampedArray(rowSize)
  for (let y = 0; y < height / 2; y++) {
    const topOffset = y * rowSize
    const bottomOffset = (height - y - 1) * rowSize
    temp.set(pixels.subarray(topOffset, topOffset + rowSize))
    pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize)
    pixels.set(temp, bottomOffset)
  }
}

export function useGLSLRenderer() {
  let canvas: OffscreenCanvas | null = null
  let gl: WebGL2RenderingContext | null = null
  let vertexShader: WebGLShader | null = null
  let program: WebGLProgram | null = null
  let fragmentShader: WebGLShader | null = null
  let pingPongFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null
  let pingPongTextures: [WebGLTexture, WebGLTexture] | null = null
  const inputTextures: (WebGLTexture | null)[] = Array.from<null>({
    length: MAX_INPUTS
  }).fill(null)
  const uniformLocations = new Map<string, WebGLUniformLocation | null>()
  let outputCount = 1
  let passCount = 1
  let disposed = false

  function initPingPongFBOs(
    ctx: WebGL2RenderingContext,
    width: number,
    height: number
  ): void {
    const fbos: WebGLFramebuffer[] = []
    const textures: WebGLTexture[] = []

    for (let i = 0; i < 2; i++) {
      const tex = ctx.createTexture()!
      ctx.bindTexture(ctx.TEXTURE_2D, tex)
      ctx.texImage2D(
        ctx.TEXTURE_2D,
        0,
        ctx.RGBA8,
        width,
        height,
        0,
        ctx.RGBA,
        ctx.UNSIGNED_BYTE,
        null
      )
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR)
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR)
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)

      const fbo = ctx.createFramebuffer()!
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fbo)
      ctx.framebufferTexture2D(
        ctx.FRAMEBUFFER,
        ctx.COLOR_ATTACHMENT0,
        ctx.TEXTURE_2D,
        tex,
        0
      )

      fbos.push(fbo)
      textures.push(tex)
    }

    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
    ctx.bindTexture(ctx.TEXTURE_2D, null)

    pingPongFBOs = fbos as [WebGLFramebuffer, WebGLFramebuffer]
    pingPongTextures = textures as [WebGLTexture, WebGLTexture]
  }

  function destroyPingPongFBOs(): void {
    if (!gl) return
    if (pingPongFBOs) {
      for (const fbo of pingPongFBOs) gl.deleteFramebuffer(fbo)
      pingPongFBOs = null
    }
    if (pingPongTextures) {
      for (const tex of pingPongTextures) gl.deleteTexture(tex)
      pingPongTextures = null
    }
  }

  function cacheUniformLocations(): void {
    if (!program || !gl) return
    for (const name of UNIFORM_NAMES) {
      uniformLocations.set(name, gl.getUniformLocation(program, name))
    }
  }

  function createEmptyTexture(): WebGLTexture {
    const tex = gl!.createTexture()!
    gl!.bindTexture(gl!.TEXTURE_2D, tex)
    gl!.texImage2D(
      gl!.TEXTURE_2D,
      0,
      gl!.RGBA,
      1,
      1,
      0,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    )
    return tex
  }

  function init(width: number, height: number): boolean {
    if (disposed) return false

    canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    })
    if (!ctx) return false

    gl = ctx
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    initPingPongFBOs(gl, width, height)
    return true
  }

  function compileFragment(source: string): CompileResult {
    if (disposed || !gl) return { success: false, log: 'Engine disposed' }

    outputCount = detectOutputCount(source)
    passCount = Math.min(detectPassCount(source), MAX_PASSES)

    if (fragmentShader) {
      gl.deleteShader(fragmentShader)
      fragmentShader = null
    }
    if (program) {
      gl.deleteProgram(program)
      program = null
    }
    uniformLocations.clear()

    try {
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, source)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, log: msg }
    }

    const prog = gl.createProgram()
    if (!prog) return { success: false, log: 'Failed to create program' }

    gl.attachShader(prog, vertexShader!)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? 'Link failed'
      gl.deleteProgram(prog)
      return { success: false, log }
    }

    program = prog
    cacheUniformLocations()
    return { success: true, log: '' }
  }

  function setResolution(width: number, height: number): void {
    if (disposed || !gl || !canvas) return
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      destroyPingPongFBOs()
      initPingPongFBOs(gl, width, height)
    }
  }

  function setFloatUniform(index: number, value: number): void {
    if (disposed || !program || !gl) return
    const loc = uniformLocations.get(`u_float${index}`)
    if (loc != null) {
      gl.useProgram(program)
      gl.uniform1f(loc, value)
    }
  }

  function setIntUniform(index: number, value: number): void {
    if (disposed || !program || !gl) return
    const loc = uniformLocations.get(`u_int${index}`)
    if (loc != null) {
      gl.useProgram(program)
      gl.uniform1i(loc, value)
    }
  }

  function bindInputImage(
    index: number,
    image: HTMLImageElement | ImageBitmap
  ): void {
    if (disposed || !gl) return

    if (inputTextures[index]) {
      gl.deleteTexture(inputTextures[index])
    }

    const texture = gl.createTexture()
    if (!texture) return

    gl.activeTexture(gl.TEXTURE0 + index)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

    inputTextures[index] = texture
  }

  function render(): void {
    if (disposed || !program || !pingPongFBOs || !gl || !canvas) return

    gl.useProgram(program)

    const resLoc = uniformLocations.get('u_resolution')
    if (resLoc != null) {
      gl.uniform2f(resLoc, canvas.width, canvas.height)
    }

    for (let i = 0; i < MAX_INPUTS; i++) {
      const loc = uniformLocations.get(`u_image${i}`)
      if (loc != null) {
        gl.activeTexture(gl.TEXTURE0 + i)
        gl.bindTexture(gl.TEXTURE_2D, inputTextures[i] ?? createEmptyTexture())
        gl.uniform1i(loc, i)
      }
    }

    const prevPassUnit = MAX_INPUTS
    const prevPassLoc = uniformLocations.get('u_prevPass')

    for (let pass = 0; pass < passCount; pass++) {
      const passLoc = uniformLocations.get('u_pass')
      if (passLoc != null) gl.uniform1i(passLoc, pass)

      const isLastPass = pass === passCount - 1
      const writeIdx = pass % 2
      const readIdx = 1 - writeIdx

      if (isLastPass) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongFBOs[writeIdx])
      }

      if (pass > 0 && prevPassLoc != null) {
        gl.activeTexture(gl.TEXTURE0 + prevPassUnit)
        gl.bindTexture(gl.TEXTURE_2D, pingPongTextures![readIdx])
        gl.uniform1i(prevPassLoc, prevPassUnit)
      }

      if (outputCount > 1 && !isLastPass) {
        const buffers = Array.from(
          { length: outputCount },
          (_, i) => gl!.COLOR_ATTACHMENT0 + i
        )
        gl.drawBuffers(buffers)
      } else {
        gl.drawBuffers([gl.BACK])
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }

  function readPixels(): ImageData {
    const w = canvas!.width
    const h = canvas!.height
    const pixels = new Uint8ClampedArray(w * h * 4)
    gl!.readPixels(0, 0, w, h, gl!.RGBA, gl!.UNSIGNED_BYTE, pixels)

    flipVertically(pixels, w, h)
    return new ImageData(pixels, w, h)
  }

  async function toBlob(): Promise<Blob> {
    return canvas!.convertToBlob({ type: 'image/png' })
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (!gl) return

    for (const tex of inputTextures) {
      if (tex) gl.deleteTexture(tex)
    }
    inputTextures.fill(null)

    destroyPingPongFBOs()

    if (fragmentShader) {
      gl.deleteShader(fragmentShader)
      fragmentShader = null
    }
    if (vertexShader) {
      gl.deleteShader(vertexShader)
      vertexShader = null
    }

    if (program) {
      gl.deleteProgram(program)
      program = null
    }

    uniformLocations.clear()

    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }

  onScopeDispose(dispose)

  return {
    init,
    compileFragment,
    setResolution,
    setFloatUniform,
    setIntUniform,
    bindInputImage,
    render,
    readPixels,
    toBlob,
    dispose
  }
}
