import { detectPassCount } from '@/renderer/glsl/glslUtils'

const VERTEX_SHADER_SOURCE = `#version 300 es
out vec2 v_texCoord;
void main() {
    vec2 verts[3] = vec2[](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
    v_texCoord = verts[gl_VertexID] * 0.5 + 0.5;
    gl_Position = vec4(verts[gl_VertexID], 0, 1);
}
`

const MAX_PASSES = 32

export interface GLSLRendererConfig {
  maxInputs: number
  maxFloatUniforms: number
  maxIntUniforms: number
  maxBoolUniforms: number
  maxCurves: number
}

const DEFAULT_CONFIG: GLSLRendererConfig = {
  maxInputs: 5,
  maxFloatUniforms: 20,
  maxIntUniforms: 20,
  maxBoolUniforms: 10,
  maxCurves: 4
}

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

export function useGLSLRenderer(config: GLSLRendererConfig = DEFAULT_CONFIG) {
  const {
    maxInputs,
    maxFloatUniforms,
    maxIntUniforms,
    maxBoolUniforms,
    maxCurves
  } = config

  const uniformNames = [
    'u_resolution',
    'u_pass',
    ...Array.from({ length: maxInputs }, (_, i) => `u_image${i}`),
    ...Array.from({ length: maxFloatUniforms }, (_, i) => `u_float${i}`),
    ...Array.from({ length: maxIntUniforms }, (_, i) => `u_int${i}`),
    ...Array.from({ length: maxBoolUniforms }, (_, i) => `u_bool${i}`),
    ...Array.from({ length: maxCurves }, (_, i) => `u_curve${i}`)
  ]

  let canvas: OffscreenCanvas | null = null
  let gl: WebGL2RenderingContext | null = null
  let vertexShader: WebGLShader | null = null
  let program: WebGLProgram | null = null
  let fragmentShader: WebGLShader | null = null
  let pingPongFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null
  let pingPongTextures: [WebGLTexture, WebGLTexture] | null = null
  let fallbackTexture: WebGLTexture | null = null
  const inputTextures: (WebGLTexture | null)[] = Array.from<null>({
    length: maxInputs
  }).fill(null)
  const curveTextures: (WebGLTexture | null)[] = Array.from<null>({
    length: maxCurves
  }).fill(null)
  const uniformLocations = new Map<string, WebGLUniformLocation | null>()
  let passCount = 1
  let disposed = false
  let lastCompiledSource: string | null = null

  function initPingPongFBOs(
    ctx: WebGL2RenderingContext,
    width: number,
    height: number
  ): void {
    const fbos: WebGLFramebuffer[] = []
    const textures: WebGLTexture[] = []

    try {
      for (let i = 0; i < 2; i++) {
        const tex = ctx.createTexture()
        if (!tex) throw new Error('Failed to create ping-pong texture')
        ctx.bindTexture(ctx.TEXTURE_2D, tex)
        ctx.texImage2D(
          ctx.TEXTURE_2D,
          0,
          ctx.RGBA16F,
          width,
          height,
          0,
          ctx.RGBA,
          ctx.HALF_FLOAT,
          null
        )
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)

        const fbo = ctx.createFramebuffer()
        if (!fbo) throw new Error('Failed to create ping-pong framebuffer')
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, fbo)
        ctx.framebufferTexture2D(
          ctx.FRAMEBUFFER,
          ctx.COLOR_ATTACHMENT0,
          ctx.TEXTURE_2D,
          tex,
          0
        )
        const status = ctx.checkFramebufferStatus(ctx.FRAMEBUFFER)
        if (status !== ctx.FRAMEBUFFER_COMPLETE)
          throw new Error(`Ping-pong framebuffer incomplete: ${status}`)

        fbos.push(fbo)
        textures.push(tex)
      }
    } catch (error) {
      for (const fbo of fbos) ctx.deleteFramebuffer(fbo)
      for (const tex of textures) ctx.deleteTexture(tex)
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
      ctx.bindTexture(ctx.TEXTURE_2D, null)
      throw error
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
    for (const name of uniformNames) {
      uniformLocations.set(name, gl.getUniformLocation(program, name))
    }
  }

  function getFallbackTexture(): WebGLTexture {
    if (!gl) throw new Error('Renderer not initialized')
    if (!fallbackTexture) {
      const tex = gl.createTexture()
      if (!tex) throw new Error('Failed to create fallback texture')
      fallbackTexture = tex
      gl.bindTexture(gl.TEXTURE_2D, fallbackTexture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255])
      )
    }
    return fallbackTexture
  }

  function init(width: number, height: number): boolean {
    if (disposed) return false

    try {
      canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      })
      if (!ctx) return false

      gl = ctx

      if (!gl.getExtension('EXT_color_buffer_float')) return false

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
      initPingPongFBOs(gl, width, height)
      return true
    } catch {
      dispose()
      return false
    }
  }

  function compileFragment(source: string): CompileResult {
    if (disposed || !gl) return { success: false, log: 'Engine disposed' }

    passCount = Math.min(detectPassCount(source), MAX_PASSES)

    if (source === lastCompiledSource && program) {
      return { success: true, log: '' }
    }
    lastCompiledSource = source

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

  function setBoolUniform(index: number, value: boolean): void {
    if (disposed || !program || !gl) return
    const loc = uniformLocations.get(`u_bool${index}`)
    if (loc != null) {
      gl.useProgram(program)
      gl.uniform1i(loc, value ? 1 : 0)
    }
  }

  function bindCurveTexture(index: number, lut: Float32Array): void {
    if (disposed || !gl) return
    if (index < 0 || index >= maxCurves) return

    if (curveTextures[index]) {
      gl.deleteTexture(curveTextures[index])
      curveTextures[index] = null
    }

    const texture = gl.createTexture()
    if (!texture) return

    const unit = maxInputs + index
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R16F,
      lut.length,
      1,
      0,
      gl.RED,
      gl.FLOAT,
      lut
    )
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    curveTextures[index] = texture
  }

  function bindInputImage(
    index: number,
    image: HTMLImageElement | ImageBitmap
  ): void {
    if (disposed || !gl) return
    if (index < 0 || index >= maxInputs) {
      throw new Error(
        `Input index ${index} out of range (max ${maxInputs - 1})`
      )
    }

    if (inputTextures[index]) {
      gl.deleteTexture(inputTextures[index])
      inputTextures[index] = null
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
    gl.disable(gl.BLEND)

    const resLoc = uniformLocations.get('u_resolution')
    if (resLoc != null) {
      gl.uniform2f(resLoc, canvas.width, canvas.height)
    }

    for (let i = 0; i < maxInputs; i++) {
      const loc = uniformLocations.get(`u_image${i}`)
      if (loc != null) {
        gl.activeTexture(gl.TEXTURE0 + i)
        gl.bindTexture(gl.TEXTURE_2D, inputTextures[i] ?? getFallbackTexture())
        gl.uniform1i(loc, i)
      }
    }

    for (let i = 0; i < maxCurves; i++) {
      const loc = uniformLocations.get(`u_curve${i}`)
      if (loc != null && curveTextures[i]) {
        const unit = maxInputs + i
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, curveTextures[i])
        gl.uniform1i(loc, unit)
      }
    }

    for (let pass = 0; pass < passCount; pass++) {
      const passLoc = uniformLocations.get('u_pass')
      if (passLoc != null) gl.uniform1i(passLoc, pass)

      const isLastPass = pass === passCount - 1
      const writeIdx = pass % 2

      if (isLastPass) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.drawBuffers([gl.BACK])
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongFBOs[writeIdx])
        gl.drawBuffers([gl.COLOR_ATTACHMENT0])
      }

      // Match backend behavior: pass > 0 binds previous pass output to
      // texture unit 0, overriding u_image0 so shaders read the previous
      // pass result via the same sampler.
      if (pass > 0) {
        const sourceTexture = pingPongTextures![(pass - 1) % 2]
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }

  function readPixels(): ImageData {
    if (!gl || !canvas) throw new Error('Renderer not initialized')
    const w = canvas.width
    const h = canvas.height
    const pixels = new Uint8ClampedArray(w * h * 4)

    gl.pixelStorei(gl.PACK_ROW_LENGTH, 0)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    return new ImageData(pixels, w, h)
  }

  async function toBlob(): Promise<Blob> {
    if (!canvas) throw new Error('Renderer not initialized')
    return canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (!gl) return

    for (const tex of inputTextures) {
      if (tex) gl.deleteTexture(tex)
    }
    inputTextures.fill(null)

    for (const tex of curveTextures) {
      if (tex) gl.deleteTexture(tex)
    }
    curveTextures.fill(null)

    if (fallbackTexture) {
      gl.deleteTexture(fallbackTexture)
      fallbackTexture = null
    }

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

  return {
    init,
    compileFragment,
    setResolution,
    setFloatUniform,
    setIntUniform,
    setBoolUniform,
    bindCurveTexture,
    bindInputImage,
    render,
    readPixels,
    toBlob,
    dispose
  }
}
