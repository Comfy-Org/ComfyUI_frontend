import { compress, encode } from '@monogrid/gainmap-js/encode'
import { encodeJPEGMetadata } from '@monogrid/gainmap-js/libultrahdr'
import { withTimeout } from 'es-toolkit'
import * as THREE from 'three'

import { gamutToSrgbMatrix } from '@/platform/hdr/colorGamut'
import { computeLuminancePercentile } from '@/platform/hdr/hdrStats'
import { loadHdrTexture, makeReader } from '@/platform/hdr/hdrTextureLoader'
import { HDR_VIEWER_VERTEX_SHADER } from '@/platform/hdr/hdrViewerShader'

const THUMBNAIL_SIZE = 256
const RENDER_TIMEOUT_MS = 30_000
const EXPOSURE_PERCENTILE = 0.99
const MAX_CONTENT_BOOST = 16
const JPEG_QUALITY = 0.9

const SCENE_LINEAR_FRAGMENT_SHADER = `
in vec2 vUv;
out vec4 frag_color;

uniform sampler2D uImage;
uniform mat3 uGamutToSRGB;
uniform float uGain;

void main() {
  vec3 mapped = uGamutToSRGB * texture(uImage, vUv).rgb * uGain;
  frag_color = vec4(max(mapped, 0.0), 1.0);
}
`

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

function contentBoost(pixels: Float32Array): number {
  let peak = 1
  for (let i = 0; i < pixels.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const value = pixels[i + channel]
      if (Number.isFinite(value) && value > peak) peak = value
    }
  }
  return Math.min(peak, MAX_CONTENT_BOOST)
}

function compressJpeg(quad: {
  width: number
  height: number
  toArray(): Uint8ClampedArray<ArrayBuffer>
}) {
  return compress({
    source: new ImageData(quad.toArray(), quad.width, quad.height),
    mimeType: 'image/jpeg',
    quality: JPEG_QUALITY,
    flipY: true
  })
}

async function render(url: string, filename: string): Promise<Blob> {
  const { texture, gamut } = await loadHdrTexture(url, filename)
  texture.colorSpace = THREE.LinearSRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true

  const scale = Math.min(
    1,
    THUMBNAIL_SIZE / Math.max(texture.image.width, texture.image.height)
  )
  const width = Math.max(1, Math.round(texture.image.width * scale))
  const height = Math.max(1, Math.round(texture.image.height * scale))

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType
  })
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HDR_VIEWER_VERTEX_SHADER,
    fragmentShader: SCENE_LINEAR_FRAGMENT_SHADER,
    uniforms: {
      uImage: { value: texture },
      uGamutToSRGB: {
        value: new THREE.Matrix3()
          .fromArray(gamutToSrgbMatrix(gamut))
          .transpose()
      },
      uGain: { value: exposureGain(texture) }
    }
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geometry, material))
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.set(0, 0, 1)

  const pixels = new Float32Array(width * height * 4)
  const sceneLinear = new THREE.DataTexture(
    pixels,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType
  )
  let encoded: ReturnType<typeof encode> | undefined

  try {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
    sceneLinear.needsUpdate = true

    encoded = encode({
      image: sceneLinear,
      renderer,
      maxContentBoost: contentBoost(pixels),
      toneMapping: THREE.LinearToneMapping
    })
    const [sdr, gainMap] = await Promise.all([
      compressJpeg(encoded.sdr),
      compressJpeg(encoded.gainMap)
    ])
    const jpeg = encodeJPEGMetadata({
      ...encoded.getMetadata(),
      sdr,
      gainMap
    })
    return new Blob([jpeg], { type: 'image/jpeg' })
  } finally {
    encoded?.sdr.dispose()
    encoded?.gainMap.dispose()
    sceneLinear.dispose()
    target.dispose()
    geometry.dispose()
    material.dispose()
    texture.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
