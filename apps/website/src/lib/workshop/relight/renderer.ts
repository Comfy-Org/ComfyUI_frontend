import type { HeightMap, ShadingUniforms } from './shading'

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// Image space throughout: x right, y down, z out of the photo. uv (0, 0) is
// the photo's top left, as the textures are uploaded unflipped.
const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uLightMap;
uniform float uRemove;
uniform vec3 uAmbient;
uniform float uReflect;
uniform float uCount;
uniform vec4 uPos[4];
uniform vec4 uColor[4];
uniform vec4 uToward[4];
uniform vec4 uMask[4];
uniform float uGrain;
uniform float uContrast;
uniform float uSeed;

const float RELIEF = 0.12;

float heightAt(vec2 uv) { return texture2D(uHeight, uv).r; }

vec3 normalAt(vec2 uv) {
  vec2 dx = vec2(uTexel.x, 0.0);
  vec2 dy = vec2(0.0, uTexel.y);
  float slopeX = heightAt(uv - dx) - heightAt(uv + dx);
  float slopeY = heightAt(uv - dy) - heightAt(uv + dy);
  return normalize(vec3(slopeX * 11.0, slopeY * 11.0, 1.0));
}

float shadowAt(vec2 uv, vec3 toward, float h) {
  vec2 across = vec2(toward.x / uAspect, toward.y);
  float run = length(across);
  if (run < 0.001) return 1.0;
  vec2 stepUv = across / run * 0.018;
  float rise = toward.z / run * 0.018;
  float blocked = 0.0;
  for (int i = 1; i <= 10; i++) {
    float t = float(i);
    float ray = h * RELIEF + rise * t;
    float ground = heightAt(uv + stepUv * t) * RELIEF;
    blocked = max(blocked, smoothstep(0.0, 0.012, ground - ray) * (1.0 - t / 12.0));
  }
  return 1.0 - blocked * 0.8;
}

float maskAt(vec4 area, vec2 uv) {
  if (area.z <= 0.0) return 1.0;
  float d = length((uv - area.xy) / area.zw);
  return 1.0 - smoothstep(0.7, 1.05, d);
}

float grain(vec2 at) {
  return fract(sin(dot(at + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 base = texture2D(uImage, vUv).rgb;
  vec3 albedo = base * base;
  float h = heightAt(vUv);
  vec3 n = normalAt(vUv);
  vec3 light = uAmbient;
  vec3 shine = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uCount) break;
    vec4 pos = uPos[i];
    vec4 color = uColor[i];
    vec4 toward = uToward[i];
    float soft = color.a;
    vec3 l = toward.xyz;
    float falloff = 1.0;
    float rim = 0.0;
    if (pos.z < 0.5) {
      vec3 offset = vec3((pos.x - vUv.x) * uAspect, pos.y - vUv.y, 0.25);
      float reach = 0.15 + soft * 0.55;
      falloff = 1.0 / (1.0 + dot(offset.xy, offset.xy) / (reach * reach) * 3.0);
      l = normalize(offset);
    } else {
      rim = pow(1.0 - n.z, 1.2) * max(-l.z, 0.0) * 3.0;
    }
    float wrap = soft * 0.4;
    float lambert = max((dot(n, l) + wrap) / (1.0 + wrap), 0.0);
    float shade = toward.w > 0.5 ? shadowAt(vUv, l, h) : 1.0;
    float energy = pos.w * falloff * shade * maskAt(uMask[i], vUv);
    light += color.rgb * energy * (lambert + rim);
    vec3 halfway = normalize(l + vec3(0.0, 0.0, 1.0));
    shine += color.rgb * energy * pow(max(dot(n, halfway), 0.0), 40.0) * uReflect;
  }
  vec3 lit = albedo * (1.0 - uRemove) + albedo * light * 1.7 + shine * 0.5;
  vec3 shown = uLightMap > 0.5 ? light * 0.45 + shine * 0.5 : lit;
  vec3 color = sqrt(shown / (1.0 + shown * 0.2));
  color = (color - 0.5) * uContrast + 0.5;
  color += (grain(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`

interface RelightDrawOptions {
  readonly lightMap?: boolean
  /** A generated image's finish: a touch more contrast, and grain. */
  readonly finish?: { readonly contrast: number; readonly grain: number }
  readonly seed?: number
}

export interface RelightRenderer {
  setImage(image: TexImageSource, height: HeightMap): void
  draw(uniforms: ShadingUniforms, options?: RelightDrawOptions): void
  dispose(): void
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | undefined {
  const shader = gl.createShader(type)
  if (!shader) return undefined
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined
}

function program(gl: WebGLRenderingContext): WebGLProgram | undefined {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vertex || !fragment) return undefined
  const linked = gl.createProgram()
  gl.attachShader(linked, vertex)
  gl.attachShader(linked, fragment)
  gl.linkProgram(linked)
  return gl.getProgramParameter(linked, gl.LINK_STATUS) ? linked : undefined
}

function texture(gl: WebGLRenderingContext, unit: number): WebGLTexture | null {
  const made = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, made)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return made
}

/**
 * Relights a photo per pixel on the GPU, from a height map's normals and the
 * packed lights. Undefined where WebGL is not available, so the caller can
 * fall back to a flatter preview.
 */
export function createRelightRenderer(
  canvas: HTMLCanvasElement,
  options: WebGLContextAttributes = {}
): RelightRenderer | undefined {
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: false,
    ...options
  })
  if (!gl) return undefined
  const shader = program(gl)
  if (!shader) return undefined
  gl.useProgram(shader)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  const aPos = gl.getAttribLocation(shader, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const photo = texture(gl, 0)
  const relief = texture(gl, 1)
  const at = (name: string) => gl.getUniformLocation(shader, name)
  gl.uniform1i(at('uImage'), 0)
  gl.uniform1i(at('uHeight'), 1)
  let aspect = 1

  return {
    setImage(image, height) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, photo)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, relief)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        height.width,
        height.height,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        height.data
      )
      aspect = height.width / height.height
      gl.uniform2f(at('uTexel'), 1 / height.width, 1 / height.height)
    },
    draw(uniforms, { lightMap = false, finish, seed = 0 } = {}) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.uniform1f(at('uAspect'), aspect)
      gl.uniform1f(at('uLightMap'), lightMap ? 1 : 0)
      gl.uniform1f(at('uRemove'), uniforms.remove)
      gl.uniform3fv(at('uAmbient'), uniforms.ambient)
      gl.uniform1f(at('uReflect'), uniforms.reflections)
      gl.uniform1f(at('uCount'), uniforms.count)
      gl.uniform4fv(at('uPos'), uniforms.position)
      gl.uniform4fv(at('uColor'), uniforms.color)
      gl.uniform4fv(at('uToward'), uniforms.toward)
      gl.uniform4fv(at('uMask'), uniforms.mask)
      gl.uniform1f(at('uContrast'), finish?.contrast ?? 1)
      gl.uniform1f(at('uGrain'), finish?.grain ?? 0)
      gl.uniform1f(at('uSeed'), seed % 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      gl.deleteTexture(photo)
      gl.deleteTexture(relief)
      gl.deleteBuffer(quad)
      gl.deleteProgram(shader)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}
