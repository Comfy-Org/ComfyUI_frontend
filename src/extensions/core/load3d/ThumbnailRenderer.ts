import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

const THUMBNAIL_SIZE = 256
const MAX_CONCURRENT = 2

let renderer: THREE.WebGLRenderer | null = null
let activeCount = 0
const pendingQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
    return Promise.resolve()
  }
  return new Promise((resolve) => pendingQueue.push(resolve))
}

function releaseSlot() {
  activeCount--
  const next = pendingQueue.shift()
  if (next) {
    activeCount++
    next()
  }
}

function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
  }
  return renderer
}

function loadModel(url: string): Promise<THREE.Object3D | null> {
  const params = new URLSearchParams(url.split('?')[1])
  const filename = params.get('filename')
  if (!filename) return Promise.resolve(null)

  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return Promise.resolve(null)

  switch (ext) {
    case 'glb':
    case 'gltf':
      return new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene)
    case 'fbx':
      return new FBXLoader().loadAsync(url)
    case 'obj':
      return new OBJLoader().loadAsync(url)
    case 'stl':
      return new STLLoader().loadAsync(url).then((geometry) => {
        geometry.computeVertexNormals()
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.1,
            roughness: 0.5
          })
        )
        const group = new THREE.Group()
        group.add(mesh)
        return group
      })
    case 'ply':
      return new PLYLoader().loadAsync(url).then((geometry) => {
        geometry.computeVertexNormals()
        const hasColors = geometry.attributes.color !== undefined
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: hasColors ? undefined : 0xcccccc,
            vertexColors: hasColors,
            metalness: 0.1,
            roughness: 0.5
          })
        )
        const group = new THREE.Group()
        group.add(mesh)
        return group
      })
    default:
      return Promise.resolve(null)
  }
}

function disposeModel(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

/**
 * Positions a camera at a consistent angle for thumbnail rendering.
 * Shared by both Load3d.captureThumbnail() and renderThumbnail().
 */
export function positionThumbnailCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D
) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const distance = maxDim * 1.5

  camera.position.set(
    center.x + distance * 0.7,
    center.y + distance * 0.5,
    center.z + distance * 0.7
  )
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

/**
 * Renders a 3D model thumbnail without creating a full Load3d instance.
 * Used as fallback in the asset browser when no preview_url is available.
 * Concurrency-limited to avoid GPU spikes.
 */
export async function renderThumbnail(modelUrl: string): Promise<Blob | null> {
  await acquireSlot()
  try {
    const model = await loadModel(modelUrl)
    if (!model) return null

    const r = getRenderer()
    const scene = new THREE.Scene()

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(1, 2, 1.5)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-1, 0, -1)
    scene.add(fillLight)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    positionThumbnailCamera(camera, model)

    scene.add(model)
    r.render(scene, camera)
    scene.remove(model)
    disposeModel(model)

    return new Promise((resolve, reject) => {
      r.domElement.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png'
      )
    })
  } finally {
    releaseSlot()
  }
}
