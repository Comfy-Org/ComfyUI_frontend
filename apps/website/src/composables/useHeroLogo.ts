import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

import { prefersReducedMotion } from './useReducedMotion'

const IMAGE_COUNT = 16
const BASE_URL = 'https://media.comfy.org/website/homepage/hero-logo-seq'

const SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 404"><path fill="#000000" d="M296.597 302.576C297.299 300.205 297.682 297.705 297.682 295.078C297.682 280.529 285.938 268.736 271.45 268.736H153.883C147.564 268.8 142.395 263.673 142.395 257.328C142.395 256.174 142.586 255.084 142.841 254.059L174.499 143.309C175.839 138.438 180.307 134.849 185.541 134.849L303.554 134.72C328.446 134.72 349.444 117.864 355.763 94.8555L373.506 33.1353C374.081 30.9562 374.4 28.5848 374.4 26.2134C374.4 11.7288 362.72 0 348.295 0H205.518C180.754 0 159.819 16.7279 153.373 39.4804L141.373 81.5886C139.969 86.3954 135.565 89.9205 130.332 89.9205H96.0573C71.4845 89.9205 50.7412 106.328 44.1034 128.824L0.957382 280.144C0.319127 282.387 0 284.823 0 287.258C0 301.807 11.7439 313.6 26.2323 313.6H59.9321C66.2508 313.6 71.4207 318.727 71.4207 325.137C71.4207 326.226 71.293 327.316 70.9739 328.341L59.0385 370.065C58.4641 372.308 58.0811 374.615 58.0811 376.987C58.0811 391.471 69.7612 403.2 84.1857 403.2L227.027 403.072C251.855 403.072 272.79 386.28 279.172 363.399L296.533 302.64L296.597 302.576Z"/></svg>`

interface HeroLogoConfig {
  speed: number
  tiltX: number
  tiltY: number
  bgColor: string
  zoom: number
  fov: number
  logoColor: string
  extrudeDepth: number
  cursorTiltStrength: number
  bgScale: number
  slideDuration: number
}

const DEFAULTS: HeroLogoConfig = {
  speed: 1,
  tiltX: -0.1,
  tiltY: -0.1,
  bgColor: '#211927',
  zoom: 7,
  fov: 50,
  logoColor: '#F2FF59',
  extrudeDepth: 200,
  cursorTiltStrength: 0.5,
  bgScale: 0.8,
  slideDuration: 0.4
}

function buildImageUrls(): string[] {
  return Array.from({ length: IMAGE_COUNT }, (_, i) => {
    const index = String(i).padStart(5, '0')
    return `${BASE_URL}/image_sequence_${index}.webp`
  })
}

function parseShapes(): THREE.Shape[] {
  const loader = new SVGLoader()
  const svgData = loader.parse(SVG_MARKUP)
  const shapes: THREE.Shape[] = []
  svgData.paths.forEach((path) => {
    shapes.push(...SVGLoader.createShapes(path))
  })
  return shapes
}

function loadTextures(urls: string[]): Promise<THREE.Texture[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<THREE.Texture | null>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const tex = new THREE.Texture(img)
            tex.needsUpdate = true
            tex.colorSpace = THREE.SRGBColorSpace
            resolve(tex)
          }
          img.onerror = () => resolve(null)
          img.src = url
        })
    )
  ).then((results) => results.filter((t): t is THREE.Texture => t !== null))
}

export function useHeroLogo(
  containerRef: Ref<HTMLElement | undefined>,
  config: Partial<HeroLogoConfig> = {}
) {
  const cfg = { ...DEFAULTS, ...config }
  let cleanup: (() => void) | undefined

  onMounted(async () => {
    const container = containerRef.value
    if (!container || prefersReducedMotion()) return

    const { width, height } = container.getBoundingClientRect()

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      stencil: true,
      alpha: true
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(cfg.bgColor, 0)
    renderer.sortObjects = true
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.opacity = '0'
    container.appendChild(renderer.domElement)

    let disposed = false
    cleanup = () => {
      disposed = true
      renderer.dispose()
      renderer.domElement.remove()
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      cfg.fov,
      width / height,
      0.1,
      1000
    )
    camera.position.z = cfg.zoom

    // SVG shape
    const shapes = parseShapes()
    const tempGeo = new THREE.ShapeGeometry(shapes)
    tempGeo.computeBoundingBox()
    const bb = tempGeo.boundingBox!
    const cx = (bb.max.x + bb.min.x) / 2
    const cy = (bb.max.y + bb.min.y) / 2
    const scaleFactor = 3 / (bb.max.y - bb.min.y)
    tempGeo.dispose()

    // Image sequence textures
    const textures = await loadTextures(buildImageUrls())
    if (disposed) return

    renderer.domElement.style.opacity = '1'
    Array.from(container.children).forEach((child) => {
      if (child !== renderer.domElement && child instanceof HTMLElement)
        child.style.display = 'none'
    })

    // Background plane (stencil read)
    const bgPlaneGeo = new THREE.PlaneGeometry(14, 14)
    const bgPlaneMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      map: textures[0] ?? null,
      depthTest: false,
      depthWrite: false,
      stencilWrite: true,
      stencilFunc: THREE.EqualStencilFunc,
      stencilRef: 1,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp
    })
    const bgPlane = new THREE.Mesh(bgPlaneGeo, bgPlaneMat)
    bgPlane.renderOrder = 1
    bgPlane.scale.set(cfg.bgScale, cfg.bgScale, 1)
    scene.add(bgPlane)

    // Logo group
    const group = new THREE.Group()
    scene.add(group)

    const s = scaleFactor
    const depth = cfg.extrudeDepth

    // Front face
    const shapeGeo = new THREE.ShapeGeometry(shapes)
    shapeGeo.translate(-cx, -cy, 0)
    shapeGeo.scale(s, -s, s)
    const shapeMat = new THREE.MeshBasicMaterial({
      color: cfg.logoColor,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true
    })
    const logoMesh = new THREE.Mesh(shapeGeo, shapeMat)
    logoMesh.renderOrder = 2
    group.add(logoMesh)

    // Extrusion stencil mask
    const extrudeGeo = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: false
    })
    extrudeGeo.translate(-cx, -cy, -depth)
    extrudeGeo.scale(s, -s, s)
    const extrudeMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      side: THREE.DoubleSide
    })
    const extrudeMesh = new THREE.Mesh(extrudeGeo, extrudeMat)
    extrudeMesh.renderOrder = 0
    group.add(extrudeMesh)

    // Interaction
    let isDragging = false
    let previousX = 0
    let dragVelocity = 0
    let currentTiltX = 0
    let currentTiltY = 0
    let pointerX = 0
    let pointerY = 0
    let rotationT = 0
    let currentSlide = 0
    let slideTimer = 0
    let animationId = 0

    function onMouseMove(e: MouseEvent) {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1
      pointerY = (e.clientY / window.innerHeight) * 2 - 1
    }

    function onPointerDown(e: PointerEvent) {
      isDragging = true
      dragVelocity = 0
      previousX = e.clientX
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return
      dragVelocity = (e.clientX - previousX) * 0.005
      rotationT += dragVelocity
      previousX = e.clientX
    }

    function onPointerUp() {
      isDragging = false
    }

    function onResize() {
      const rect = container!.getBoundingClientRect()
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height)
    }

    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()

    function animate() {
      if (disposed) return
      animationId = requestAnimationFrame(animate)
      const dt = clock.getDelta()

      if (!isDragging && Math.abs(dragVelocity) > 0.0001) {
        dragVelocity *= 0.95
        rotationT += dragVelocity
      } else if (!isDragging) {
        dragVelocity = 0
      }

      rotationT += cfg.speed * dt

      currentTiltX += (pointerY - currentTiltX) * 0.08
      currentTiltY += (pointerX - currentTiltY) * 0.08

      group.rotation.y = rotationT % (Math.PI * 2)
      group.rotation.x = cfg.tiltX - currentTiltX * cfg.cursorTiltStrength
      group.rotation.z = cfg.tiltY

      if (textures.length > 1) {
        slideTimer += dt
        if (slideTimer >= cfg.slideDuration) {
          slideTimer = 0
          currentSlide = (currentSlide + 1) % textures.length
          bgPlaneMat.map = textures[currentSlide]
          bgPlaneMat.needsUpdate = true
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    cleanup = () => {
      disposed = true
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', onResize)
      bgPlaneGeo.dispose()
      bgPlaneMat.dispose()
      shapeGeo.dispose()
      shapeMat.dispose()
      extrudeGeo.dispose()
      extrudeMat.dispose()
      textures.forEach((tex) => tex.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  })

  onUnmounted(() => {
    cleanup?.()
  })
}
