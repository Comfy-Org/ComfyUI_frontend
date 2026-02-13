import type { Ref, ShallowRef } from 'vue'
import { onBeforeUnmount, watch } from 'vue'

import { curvesToLUT } from '@/components/colorcurves/curveUtils'
import type { ColorCurvesSettings } from '@/lib/litegraph/src/types/widgets'

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
uniform sampler2D u_lut;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec4 texel = texture(u_image, v_texCoord);

  float r = texture(u_lut, vec2(texel.r, 0.25)).r;
  float g = texture(u_lut, vec2(texel.g, 0.25)).g;
  float b = texture(u_lut, vec2(texel.b, 0.25)).b;

  r = texture(u_lut, vec2(r, 0.75)).a;
  g = texture(u_lut, vec2(g, 0.75)).a;
  b = texture(u_lut, vec2(b, 0.75)).a;

  outColor = vec4(r, g, b, texel.a);
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
  imageTexture: WebGLTexture
  lutTexture: WebGLTexture
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

  const imageTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, imageTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const lutTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, lutTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'u_lut'), 1)

  return { gl, program, imageTexture, lutTexture, vao }
}

function uploadImageTexture(state: GLState, img: HTMLImageElement) {
  const { gl, imageTexture } = state
  gl.canvas.width = img.naturalWidth
  gl.canvas.height = img.naturalHeight
  gl.viewport(0, 0, img.naturalWidth, img.naturalHeight)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, imageTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
}

const DEFAULT_POINTS: [number, number][] = [
  [0, 0],
  [1, 1]
]

function uploadLUT(state: GLState, settings: ColorCurvesSettings) {
  const { gl, lutTexture } = state

  const redLUT = curvesToLUT(settings.red ?? DEFAULT_POINTS)
  const greenLUT = curvesToLUT(settings.green ?? DEFAULT_POINTS)
  const blueLUT = curvesToLUT(settings.blue ?? DEFAULT_POINTS)
  const rgbLUT = curvesToLUT(settings.rgb ?? DEFAULT_POINTS)

  // 256x2 RGBA texture
  // Row 0 (y=0.25): R=redLUT, G=greenLUT, B=blueLUT, A=unused
  // Row 1 (y=0.75): R/G/B/A = rgbLUT (master curve)
  const data = new Uint8Array(256 * 2 * 4)

  for (let i = 0; i < 256; i++) {
    // Row 0: per-channel curves
    const offset0 = i * 4
    data[offset0] = redLUT[i]
    data[offset0 + 1] = greenLUT[i]
    data[offset0 + 2] = blueLUT[i]
    data[offset0 + 3] = 255

    // Row 1: RGB master curve
    const offset1 = (256 + i) * 4
    data[offset1] = rgbLUT[i]
    data[offset1 + 1] = rgbLUT[i]
    data[offset1 + 2] = rgbLUT[i]
    data[offset1 + 3] = rgbLUT[i]
  }

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, lutTexture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    256,
    2,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  )
}

function render(state: GLState) {
  state.gl.drawArrays(state.gl.TRIANGLES, 0, 6)
}

export function useWebGLColorCurves(
  canvasRef: ShallowRef<HTMLCanvasElement | null>,
  imageUrl: Ref<string | null>,
  settings: Ref<ColorCurvesSettings>
) {
  let state: GLState | null = null
  let currentImage: HTMLImageElement | null = null
  let pendingRaf = 0

  function scheduleRender() {
    if (!state || !currentImage?.complete) return
    if (pendingRaf) return
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0
      if (state) {
        uploadLUT(state, settings.value)
        render(state)
      }
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
      uploadImageTexture(state, img)
      uploadLUT(state, settings.value)
      render(state)
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
      const { gl, program, imageTexture, lutTexture, vao } = state
      gl.deleteTexture(imageTexture)
      gl.deleteTexture(lutTexture)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      state = null
    }
    currentImage = null
  }

  onBeforeUnmount(cleanup)
}
