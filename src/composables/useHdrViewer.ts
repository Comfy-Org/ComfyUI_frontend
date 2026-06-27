import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'

import type { ChromaticityCoords, GamutName } from '@/renderer/hdr/colorGamut'
import {
  detectGamutFromChromaticities,
  gamutToSrgbMatrix
} from '@/renderer/hdr/colorGamut'
import {
  HDR_VIEWER_FRAGMENT_SHADER,
  HDR_VIEWER_VERTEX_SHADER
} from '@/renderer/hdr/hdrViewerShader'
import type { ChannelHistograms, ImageStats } from '@/renderer/hdr/hdrStats'
import {
  computeChannelHistograms,
  computeImageStats
} from '@/renderer/hdr/hdrStats'
import { WebGLViewport } from '@/renderer/three/WebGLViewport'
import { getImageFilenameFromUrl } from '@/utils/hdrFormatUtil'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 64

export type ChannelMode = 'rgb' | 'r' | 'g' | 'b' | 'a' | 'luminance'

export const CHANNEL_MODES: ChannelMode[] = [
  'rgb',
  'r',
  'g',
  'b',
  'a',
  'luminance'
]

const CHANNEL_INDEX: Record<ChannelMode, number> = {
  rgb: 0,
  r: 1,
  g: 2,
  b: 3,
  a: 4,
  luminance: 5
}

interface PixelReadout {
  x: number
  y: number
  r: number
  g: number
  b: number
  a: number | null
}

interface ExrTexData {
  header?: { chromaticities?: ChromaticityCoords }
}

function createLoader(url: string) {
  const filename = getImageFilenameFromUrl(url)
  if (filename?.toLowerCase().endsWith('.hdr')) return new RGBELoader()
  const loader = new EXRLoader()
  loader.setDataType(THREE.FloatType)
  return loader
}

function makeReader(
  data: ArrayLike<number>,
  type: THREE.TextureDataType
): (index: number) => number {
  if (type === THREE.HalfFloatType) {
    return (index) => THREE.DataUtils.fromHalfFloat(data[index])
  }
  return (index) => data[index]
}

function loadHdrTexture(
  url: string
): Promise<{ texture: THREE.DataTexture; gamut: GamutName }> {
  return new Promise((resolve, reject) => {
    createLoader(url).load(
      url,
      (texture, texData) => {
        const chromaticities = (texData as ExrTexData)?.header?.chromaticities
        resolve({
          texture,
          gamut: detectGamutFromChromaticities(chromaticities)
        })
      },
      undefined,
      reject
    )
  })
}

export function useHdrViewer() {
  const exposureStops = ref(0)
  const dither = ref(true)
  const clipWarnings = ref(false)
  const gamut = ref<GamutName>('sRGB')
  const channel = ref<ChannelMode>('rgb')
  const loading = ref(true)
  const error = ref<string | null>(null)
  const dimensions = ref<string | null>(null)
  const stats = ref<ImageStats | null>(null)
  const histograms = shallowRef<ChannelHistograms | null>(null)
  const pixel = ref<PixelReadout | null>(null)

  const histogram = computed<Uint32Array | null>(() => {
    const channelHistograms = histograms.value
    if (!channelHistograms) return null
    switch (channel.value) {
      case 'r':
        return channelHistograms.r
      case 'g':
        return channelHistograms.g
      case 'b':
        return channelHistograms.b
      case 'a':
        return channelHistograms.a
      default:
        return channelHistograms.luminance
    }
  })

  const containerRef = shallowRef<HTMLElement | null>(null)

  let renderer: THREE.WebGLRenderer | null = null
  let viewport: WebGLViewport | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.OrthographicCamera | null = null
  let material: THREE.ShaderMaterial | null = null
  let mesh: THREE.Mesh | null = null
  let texture: THREE.Texture | null = null
  let imageAspect = 1
  let frameRequested = false

  let readSample: ((index: number) => number) | null = null
  let imageWidth = 0
  let imageHeight = 0
  let imageChannels = 4

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  function requestRender() {
    if (!renderer || frameRequested) return
    frameRequested = true
    requestAnimationFrame(() => {
      frameRequested = false
      if (renderer && scene && camera) renderer.render(scene, camera)
    })
  }

  function containerSize() {
    const el = containerRef.value
    return {
      width: el?.clientWidth || 1,
      height: el?.clientHeight || 1
    }
  }

  function updateProjection() {
    if (!camera) return
    const { width, height } = containerSize()
    const halfH = 0.5
    const halfW = (0.5 * width) / height
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
  }

  function fitView() {
    if (!camera) return
    const { width, height } = containerSize()
    const containerAspect = width / height
    camera.zoom = Math.min(1, containerAspect / imageAspect)
    camera.position.set(0, 0, 1)
    camera.updateProjectionMatrix()
    requestRender()
  }

  function applyUniforms() {
    if (!material) return
    material.uniforms.uGain.value = Math.pow(2, exposureStops.value)
    material.uniforms.uDither.value = dither.value
    material.uniforms.uClipWarnings.value = clipWarnings.value
    material.uniforms.uChannel.value = CHANNEL_INDEX[channel.value]
    const m = gamutToSrgbMatrix(gamut.value)
    ;(material.uniforms.uGamutToSRGB.value as THREE.Matrix3).set(
      m[0],
      m[1],
      m[2],
      m[3],
      m[4],
      m[5],
      m[6],
      m[7],
      m[8]
    )
    requestRender()
  }

  function buildScene() {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    viewport = new WebGLViewport(renderer)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x0a0a0a, 1)

    scene = new THREE.Scene()
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.set(0, 0, 1)

    material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: HDR_VIEWER_VERTEX_SHADER,
      fragmentShader: HDR_VIEWER_FRAGMENT_SHADER,
      uniforms: {
        uImage: { value: null },
        uGamutToSRGB: { value: new THREE.Matrix3() },
        uGain: { value: 1 },
        uChannel: { value: 0 },
        uDither: { value: true },
        uClipWarnings: { value: false },
        uClipRange: { value: new THREE.Vector2(0, 1) }
      }
    })

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    scene.add(mesh)
  }

  function resize() {
    if (!renderer) return
    const { width, height } = containerSize()
    renderer.setSize(width, height, false)
    updateProjection()
    requestRender()
  }

  function setTexture(loaded: THREE.DataTexture) {
    if (!material || !mesh) return
    loaded.colorSpace = THREE.LinearSRGBColorSpace
    loaded.minFilter = THREE.LinearFilter
    loaded.magFilter = THREE.LinearFilter
    loaded.needsUpdate = true

    const { width, height, data } = loaded.image
    texture = loaded
    imageAspect = width / height
    mesh.scale.set(imageAspect, 1, 1)
    material.uniforms.uImage.value = loaded
    dimensions.value = `${width} x ${height}`

    if (!data) return
    imageWidth = width
    imageHeight = height
    imageChannels = data.length / (width * height)
    readSample = makeReader(data, loaded.type)
    stats.value = computeImageStats(readSample, data.length, imageChannels)
    histograms.value = computeChannelHistograms(
      readSample,
      data.length,
      imageChannels
    )
  }

  async function mount(container: HTMLElement, url: string) {
    containerRef.value = container
    loading.value = true
    error.value = null

    try {
      buildScene()
      container.appendChild(renderer!.domElement)
      renderer!.domElement.classList.add('block', 'size-full')
      resize()
      applyUniforms()
      attachInteractions(renderer!.domElement)
      viewport!.observeResize(container, resize)

      const { texture: loaded, gamut: detectedGamut } =
        await loadHdrTexture(url)
      if (!material || !mesh) {
        loaded.dispose()
        return
      }
      gamut.value = detectedGamut
      setTexture(loaded)
      applyUniforms()
      fitView()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      dispose()
    } finally {
      loading.value = false
    }
  }

  function normalizeExposure() {
    const max = stats.value?.max ?? 0
    exposureStops.value = max > 0 ? -Math.log2(max) : 0
  }

  function attachInteractions(canvas: HTMLCanvasElement) {
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onHoverMove)
    canvas.addEventListener('pointerleave', onHoverLeave)
  }

  function onWheel(event: WheelEvent) {
    if (!camera) return
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.001)
    const nextZoom = THREE.MathUtils.clamp(
      camera.zoom * factor,
      MIN_ZOOM,
      MAX_ZOOM
    )
    camera.zoom = nextZoom
    camera.updateProjectionMatrix()
    requestRender()
  }

  let dragStart: { x: number; y: number; camX: number; camY: number } | null =
    null

  function onPointerDown(event: PointerEvent) {
    if (!camera) return
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      camX: camera.position.x,
      camY: camera.position.y
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(event: PointerEvent) {
    if (!camera || !dragStart) return
    const { height } = containerSize()
    const worldPerPixel = 1 / (height * camera.zoom)
    camera.position.x =
      dragStart.camX - (event.clientX - dragStart.x) * worldPerPixel
    camera.position.y =
      dragStart.camY + (event.clientY - dragStart.y) * worldPerPixel
    requestRender()
  }

  function onPointerUp() {
    dragStart = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function onHoverMove(event: PointerEvent) {
    if (!camera || !mesh || !renderer || dragStart || !readSample) return
    const rect = renderer.domElement.getBoundingClientRect()
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    raycaster.setFromCamera(pointerNdc, camera)
    const hit = raycaster.intersectObject(mesh)[0]
    if (!hit?.uv) {
      pixel.value = null
      return
    }
    const col = THREE.MathUtils.clamp(
      Math.floor(hit.uv.x * imageWidth),
      0,
      imageWidth - 1
    )
    const row = THREE.MathUtils.clamp(
      Math.floor(hit.uv.y * imageHeight),
      0,
      imageHeight - 1
    )
    const base = (row * imageWidth + col) * imageChannels
    pixel.value = {
      x: col,
      y: imageHeight - 1 - row,
      r: readSample(base),
      g: readSample(base + 1),
      b: readSample(base + 2),
      a: imageChannels === 4 ? readSample(base + 3) : null
    }
  }

  function onHoverLeave() {
    pixel.value = null
  }

  function dispose() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (renderer) {
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onHoverMove)
      renderer.domElement.removeEventListener('pointerleave', onHoverLeave)
    }
    viewport?.disposeRenderer()
    texture?.dispose()
    material?.dispose()
    mesh?.geometry.dispose()

    renderer = null
    viewport = null
    scene = null
    camera = null
    material = null
    mesh = null
    texture = null
    readSample = null
  }

  watch([exposureStops, dither, clipWarnings, gamut, channel], applyUniforms)

  onUnmounted(dispose)

  return {
    exposureStops,
    dither,
    clipWarnings,
    gamut,
    channel,
    loading,
    error,
    dimensions,
    stats,
    histogram,
    pixel,
    mount,
    dispose,
    fitView,
    normalizeExposure
  }
}
