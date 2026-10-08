import * as THREE from 'three'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader'

const FXAA_SAMPLE = 'return texture( tex2D, uv );'

const resolveVertexShader = /* glsl */ `
  uniform vec2 uvScale;
  varying vec2 vUv;

  void main() {
    vUv = uv * uvScale;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export function createRegionFxaaFragmentShader(): string {
  return FXAAShader.fragmentShader
    .replace(
      'uniform vec2 resolution;',
      'uniform vec2 resolution;\nuniform vec2 uvScale;'
    )
    .replace(
      FXAA_SAMPLE,
      'return texture( tex2D, clamp( uv, 0.5 * resolution, uvScale - 0.5 * resolution ) );'
    )
}

export function createHighPrecisionTarget(
  width = 1,
  height = 1
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthBuffer: true
  })
  return Object.assign(target, { isXRRenderTarget: true })
}

export function ensureTargetSize(
  target: THREE.WebGLRenderTarget,
  width: number,
  height: number
): void {
  if (target.width >= width && target.height >= height) return
  target.setSize(Math.max(target.width, width), Math.max(target.height, height))
}

export type FxaaResolve = {
  render(
    renderer: THREE.WebGLRenderer,
    source: THREE.WebGLRenderTarget,
    width: number,
    height: number
  ): void
  dispose(): void
}

export function createFxaaResolve(): FxaaResolve {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2() },
      uvScale: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: resolveVertexShader,
    fragmentShader: createRegionFxaaFragmentShader(),
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const quad = new THREE.Mesh(geometry, material)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  return {
    render(renderer, source, width, height) {
      material.uniforms.tDiffuse.value = source.texture
      material.uniforms.resolution.value.set(
        1 / source.width,
        1 / source.height
      )
      material.uniforms.uvScale.value.set(
        width / source.width,
        height / source.height
      )
      renderer.setRenderTarget(null)
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, width, height)
      renderer.render(scene, camera)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    }
  }
}
