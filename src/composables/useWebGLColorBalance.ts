import type { Ref, ShallowRef } from 'vue'
import { onBeforeUnmount, watch } from 'vue'

import type { ColorBalanceSettings } from '@/lib/litegraph/src/types/widgets'

const VERTEX_SRC = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

const FRAGMENT_SRC = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec3 u_shadows;
uniform vec3 u_midtones;
uniform vec3 u_highlights;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec4 texel = texture(u_image, v_texCoord);
  vec3 color = texel.rgb;

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

  float st = clamp(luminance * 2.0, 0.0, 1.0);
  float shadowWeight = 1.0 - st * st * (3.0 - 2.0 * st);

  float ht = clamp(luminance * 2.0 - 1.0, 0.0, 1.0);
  float highlightWeight = ht * ht * (3.0 - 2.0 * ht);

  float midtoneWeight = 1.0 - shadowWeight - highlightWeight;

  vec3 offset = shadowWeight * u_shadows
              + midtoneWeight * u_midtones
              + highlightWeight * u_highlights;

  outColor = vec4(clamp(color + offset, 0.0, 1.0), texel.a);
}
`

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

interface GLState {
  gl: WebGL2RenderingContext
  program: WebGLProgram
  texture: WebGLTexture
  uShadows: WebGLUniformLocation
  uMidtones: WebGLUniformLocation
  uHighlights: WebGLUniformLocation
  vao: WebGLVertexArrayObject
}

function initGL(canvas: HTMLCanvasElement): GLState | null {
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    alpha: true
  })
  if (!gl) return null

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC)

  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.useProgram(program)

  gl.deleteShader(vs)
  gl.deleteShader(fs)

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const positions = new Float32Array([
    -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1, 0
  ])
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const aPos = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0)

  const aTex = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(aTex)
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8)

  const texture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)

  return {
    gl,
    program,
    texture,
    uShadows: gl.getUniformLocation(program, 'u_shadows')!,
    uMidtones: gl.getUniformLocation(program, 'u_midtones')!,
    uHighlights: gl.getUniformLocation(program, 'u_highlights')!,
    vao
  }
}

function uploadTexture(state: GLState, img: HTMLImageElement) {
  const { gl, texture } = state
  gl.canvas.width = img.naturalWidth
  gl.canvas.height = img.naturalHeight
  gl.viewport(0, 0, img.naturalWidth, img.naturalHeight)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
}

function render(state: GLState, settings: ColorBalanceSettings) {
  const { gl, uShadows, uMidtones, uHighlights } = state
  gl.uniform3f(
    uShadows,
    settings.shadows_red / 100,
    settings.shadows_green / 100,
    settings.shadows_blue / 100
  )
  gl.uniform3f(
    uMidtones,
    settings.midtones_red / 100,
    settings.midtones_green / 100,
    settings.midtones_blue / 100
  )
  gl.uniform3f(
    uHighlights,
    settings.highlights_red / 100,
    settings.highlights_green / 100,
    settings.highlights_blue / 100
  )
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

export function useWebGLColorBalance(
  canvasRef: ShallowRef<HTMLCanvasElement | null>,
  imageUrl: Ref<string | null>,
  settings: Ref<ColorBalanceSettings>
) {
  let state: GLState | null = null
  let currentImage: HTMLImageElement | null = null
  let pendingRaf = 0

  function scheduleRender() {
    if (!state || !currentImage?.complete) return
    if (pendingRaf) return
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0
      if (state) render(state, settings.value)
    })
  }

  function loadImage(url: string | null) {
    currentImage = null
    if (!url || !state) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!state) return
      currentImage = img
      uploadTexture(state, img)
      render(state, settings.value)
    }
    img.src = url
  }

  watch(
    canvasRef,
    (canvas) => {
      if (!canvas) {
        cleanup()
        return
      }
      state = initGL(canvas)
      if (state && imageUrl.value) loadImage(imageUrl.value)
    },
    { immediate: true }
  )

  watch(imageUrl, (url) => loadImage(url))
  watch(settings, () => scheduleRender(), { deep: true })

  function cleanup() {
    if (pendingRaf) {
      cancelAnimationFrame(pendingRaf)
      pendingRaf = 0
    }
    if (state) {
      const { gl, program, texture, vao } = state
      gl.deleteTexture(texture)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      state = null
    }
    currentImage = null
  }

  onBeforeUnmount(cleanup)
}
