import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

const THUMBNAIL_SIZE = 256
const CACHE_NAME = 'comfyui-3d-thumbnails'

let renderer: THREE.WebGLRenderer | null = null

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

function createScene(): THREE.Scene {
  const scene = new THREE.Scene()

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
  keyLight.position.set(1, 2, 1.5)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-1, 0, -1)
  scene.add(fillLight)

  return scene
}

function createCamera(model: THREE.Object3D): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)

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

  return camera
}

function getFileExtension(url: string): string | null {
  const params = new URLSearchParams(url.split('?')[1])
  const filename = params.get('filename')
  if (!filename) return null
  return filename.split('.').pop()?.toLowerCase() ?? null
}

async function loadModel(url: string): Promise<THREE.Object3D | null> {
  const ext = getFileExtension(url)
  if (!ext) return null

  switch (ext) {
    case 'glb':
    case 'gltf': {
      const gltf = await new GLTFLoader().loadAsync(url)
      return gltf.scene
    }
    case 'fbx':
      return await new FBXLoader().loadAsync(url)
    case 'obj':
      return await new OBJLoader().loadAsync(url)
    case 'stl': {
      const geometry = await new STLLoader().loadAsync(url)
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
    }
    case 'ply': {
      const geometry = await new PLYLoader().loadAsync(url)
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
    }
    default:
      return null
  }
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

function renderToBlob(model: THREE.Object3D): Promise<Blob> {
  const r = getRenderer()
  const scene = createScene()
  const camera = createCamera(model)

  scene.add(model)
  r.render(scene, camera)
  scene.remove(model)
  disposeObject(model)

  return new Promise((resolve, reject) => {
    r.domElement.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    )
  })
}

async function getCached(url: string): Promise<string | null> {
  try {
    const store = await caches.open(CACHE_NAME)
    const response = await store.match(url)
    if (!response) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

async function setCache(url: string, blob: Blob): Promise<void> {
  try {
    const store = await caches.open(CACHE_NAME)
    await store.put(
      url,
      new Response(blob, { headers: { 'Content-Type': 'image/png' } })
    )
  } catch {
    // Cache write failures are non-critical; silently ignore
  }
}

export async function generate3DThumbnail(
  modelUrl: string
): Promise<string | null> {
  const cached = await getCached(modelUrl)
  if (cached) return cached

  const model = await loadModel(modelUrl)
  if (!model) return null

  const blob = await renderToBlob(model)
  await setCache(modelUrl, blob)
  return URL.createObjectURL(blob)
}
