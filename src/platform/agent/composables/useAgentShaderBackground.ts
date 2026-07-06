import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Ref } from 'vue'

import type { AgentShaderParams } from '@/platform/agent/composables/agentPersonalityState'

const VERTEX_SHADER_SOURCE = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 verts[3] = vec2[](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
  v_uv = verts[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}
`

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform float u_hueBase;
uniform float u_hueRange;
uniform float u_speed;
uniform float u_scale;
uniform float u_intensity;
uniform float u_glow;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 p = (v_uv - 0.5) * u_scale;
  float t = u_time * u_speed;

  float plasma = sin(p.x + t) + sin(p.y * 1.3 - t * 0.8) +
    sin((p.x + p.y) * 0.7 + t * 1.4) + sin(length(p) * 2.0 - t);
  plasma = plasma * 0.25 + 0.5;

  float hue = fract((u_hueBase + plasma * u_hueRange) / 360.0);
  vec3 color = hsl2rgb(hue, 0.75, 0.5 + plasma * 0.15);

  float dist = length(v_uv - 0.5);
  float glow = smoothstep(0.7, 0.0, dist) * u_glow;

  float alpha = clamp(plasma * u_intensity + glow, 0.0, 1.0);
  outColor = vec4(color, alpha);
}
`

const UNIFORM_NAMES = [
  'u_time',
  'u_hueBase',
  'u_hueRange',
  'u_speed',
  'u_scale',
  'u_intensity',
  'u_glow'
] as const

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER_SOURCE
  )
  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

/**
 * Renders an animated plasma-style aura into a canvas, driven by the given
 * tunable params. No-ops safely when WebGL2 is unavailable (e.g. jsdom,
 * unsupported browsers) so it never breaks the elements it decorates.
 */
export function useAgentShaderBackground(
  canvasRef: Ref<HTMLCanvasElement | null | undefined>,
  params: AgentShaderParams,
  reducedMotion: Ref<boolean>
) {
  const isSupported = ref(false)

  let gl: WebGL2RenderingContext | null = null
  let program: WebGLProgram | null = null
  let resizeObserver: ResizeObserver | null = null
  let rafId: number | null = null
  let startTime: number | null = null
  const uniformLocations = new Map<string, WebGLUniformLocation | null>()

  function resize() {
    const canvas = canvasRef.value
    if (!canvas || !gl) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
  }

  function draw(elapsedSeconds: number) {
    if (!gl || !program) return
    gl.useProgram(program)
    gl.uniform1f(uniformLocations.get('u_time') ?? null, elapsedSeconds)
    gl.uniform1f(uniformLocations.get('u_hueBase') ?? null, params.hueBase)
    gl.uniform1f(uniformLocations.get('u_hueRange') ?? null, params.hueRange)
    gl.uniform1f(uniformLocations.get('u_speed') ?? null, params.speed)
    gl.uniform1f(uniformLocations.get('u_scale') ?? null, params.scale)
    gl.uniform1f(uniformLocations.get('u_intensity') ?? null, params.intensity)
    gl.uniform1f(uniformLocations.get('u_glow') ?? null, params.glow)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function frame(now: number) {
    if (!gl || !program) return
    startTime ??= now
    draw((now - startTime) / 1000)
    if (!reducedMotion.value) {
      rafId = requestAnimationFrame(frame)
    }
  }

  function start() {
    const canvas = canvasRef.value
    if (!canvas) return

    const context = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false
    })
    if (!context) return

    const compiledProgram = createProgram(context)
    if (!compiledProgram) return

    gl = context
    program = compiledProgram
    isSupported.value = true

    for (const name of UNIFORM_NAMES) {
      uniformLocations.set(name, gl.getUniformLocation(program, name))
    }

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    rafId = requestAnimationFrame(frame)
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    if (gl && program) gl.deleteProgram(program)
    program = null
    gl = null
    startTime = null
  }

  onMounted(start)
  onBeforeUnmount(stop)

  return { isSupported }
}
