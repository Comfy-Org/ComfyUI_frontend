import { withTimeout } from 'es-toolkit'
import * as THREE from 'three'

import { gamutToSrgbMatrix } from '@/platform/hdr/colorGamut'
import { computeLuminancePercentile } from '@/platform/hdr/hdrStats'
import { loadHdrTexture, makeReader } from '@/platform/hdr/hdrTextureLoader'
import {
  HDR_VIEWER_FRAGMENT_SHADER,
  HDR_VIEWER_VERTEX_SHADER
} from '@/platform/hdr/hdrViewerShader'

const THUMBNAIL_SIZE = 256
const RENDER_TIMEOUT_MS = 30_000
const EXPOSURE_PERCENTILE = 0.99

let queue: Promise<unknown> = Promise.resolve()

export function renderHdrThumbnail(url: string, filename: string) {
  const run = queue.then(() =>
    withTimeout(() => render(url, filename), RENDER_TIMEOUT_MS)
  )
  queue = run.catch(() => null)
  return run
}

function exposureGain(texture: THREE.DataTexture): number {
  const { width, height, data } = texture.image
  if (!data) return 1
  const reference = computeLuminancePercentile(
    makeReader(data, texture.type),
    data.length,
    data.length / (width * height),
    EXPOSURE_PERCENTILE
  )
  return reference > 0 ? 1 / reference : 1
}

async function render(url: string, filename: string): Promise<Blob> {
  const { texture, gamut } = await loadHdrTexture(url, filename)
  texture.colorSpace = THREE.LinearSRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true

  const { width, height } = texture.image
  const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(width, height))

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true
  })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setSize(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
    false
  )

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HDR_VIEWER_VERTEX_SHADER,
    fragmentShader: HDR_VIEWER_FRAGMENT_SHADER,
    uniforms: {
      uImage: { value: texture },
      uGamutToSRGB: {
        value: new THREE.Matrix3()
          .fromArray(gamutToSrgbMatrix(gamut))
          .transpose()
      },
      uGain: { value: exposureGain(texture) },
      uChannel: { value: 0 },
      uDither: { value: false },
      uClipWarnings: { value: false },
      uClipRange: { value: new THREE.Vector2(0, 1) }
    }
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geometry, material))
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.set(0, 0, 1)

  try {
    renderer.render(scene, camera)
    return await new Promise<Blob>((resolve, reject) =>
      renderer.domElement.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Thumbnail encode failed')),
        'image/png'
      )
    )
  } finally {
    geometry.dispose()
    material.dispose()
    texture.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
