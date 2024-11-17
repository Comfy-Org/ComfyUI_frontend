import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useToastStore } from '@/stores/toastStore'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { IWidget } from '@comfyorg/litegraph'
import { nextTick } from 'vue'

async function uploadFile(
  modelWidget: IWidget,
  load3d: Load3d,
  file: File,
  updateNode: boolean,
  fileInput?: HTMLInputElement
) {
  try {
    const body = new FormData()
    body.append('image', file)
    body.append('subfolder', '3d')

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status === 200) {
      const data = await resp.json()
      let path = data.name
      if (data.subfolder) path = data.subfolder + '/' + path

      if (!modelWidget?.options?.values?.includes(path)) {
        modelWidget?.options?.values?.push(path)
      }

      if (updateNode) {
        modelWidget.value = path
        const modelUrl = api.apiURL(getResourceURL(...splitFilePath(path)))
        await load3d.loadModel(modelUrl, file.name)
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase()
      if (fileExt === 'obj' && fileInput?.files) {
        try {
          const mtlFile = Array.from(fileInput.files).find((f) =>
            f.name.toLowerCase().endsWith('.mtl')
          )

          if (mtlFile) {
            const mtlFormData = new FormData()
            mtlFormData.append('image', mtlFile)
            mtlFormData.append('subfolder', '3d')

            await api.fetchApi('/upload/image', {
              method: 'POST',
              body: mtlFormData
            })
          }
        } catch (mtlError) {
          console.warn('Failed to upload MTL file:', mtlError)
        }
      }
    } else {
      useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    }
  } catch (error) {
    console.error('Upload error:', error)
    useToastStore().addAlert(
      error instanceof Error ? error.message : 'Upload failed'
    )
  }
}

class Load3d {
  scene: THREE.Scene
  perspectiveCamera: THREE.PerspectiveCamera
  orthographicCamera: THREE.OrthographicCamera
  activeCamera: THREE.Camera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  gltfLoader: GLTFLoader
  objLoader: OBJLoader
  mtlLoader: MTLLoader
  fbxLoader: FBXLoader
  stlLoader: STLLoader
  currentModel: THREE.Object3D | null = null
  currentAnimation: THREE.AnimationMixer | null = null
  animationActions: THREE.AnimationAction[] = []
  isAnimationPlaying: boolean = false
  node: any
  private animationFrameId: number | null = null
  gridHelper: THREE.GridHelper
  lights: THREE.Light[] = []
  clock: THREE.Clock
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]> =
    new WeakMap()

  materialMode: 'original' | 'normal' | 'wireframe' = 'original'

  constructor(container: Element | HTMLElement) {
    this.scene = new THREE.Scene()

    this.perspectiveCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    this.perspectiveCamera.position.set(5, 5, 5)

    const frustumSize = 10
    this.orthographicCamera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    )
    this.orthographicCamera.position.set(5, 5, 5)

    this.activeCamera = this.perspectiveCamera

    this.perspectiveCamera.lookAt(0, 0, 0)
    this.orthographicCamera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(300, 300)
    this.renderer.setClearColor(0x282828)

    const rendererDomElement: HTMLCanvasElement = this.renderer.domElement

    container.appendChild(rendererDomElement)

    this.controls = new OrbitControls(
      this.activeCamera,
      this.renderer.domElement
    )
    this.controls.enableDamping = true

    this.gltfLoader = new GLTFLoader()
    this.objLoader = new OBJLoader()
    this.mtlLoader = new MTLLoader()
    this.fbxLoader = new FBXLoader()
    this.stlLoader = new STLLoader()
    this.clock = new THREE.Clock()

    this.setupLights()

    this.gridHelper = new THREE.GridHelper(10, 10)
    this.gridHelper.position.set(0, 0, 0)
    this.scene.add(this.gridHelper)

    this.normalMaterial = new THREE.MeshNormalMaterial({
      flatShading: false,
      side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1, 1),
      transparent: false,
      opacity: 1.0
    })

    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: false,
      opacity: 1.0
    })

    this.standardMaterial = this.createSTLMaterial()

    this.animate()

    this.handleResize()

    this.startAnimation()
  }

  setMaterialMode(mode: 'original' | 'normal' | 'wireframe') {
    this.materialMode = mode

    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          switch (mode) {
            case 'normal':
              if (!this.originalMaterials.has(child)) {
                this.originalMaterials.set(child, child.material)
              }
              child.material = new THREE.MeshNormalMaterial({
                flatShading: false,
                side: THREE.DoubleSide,
                normalScale: new THREE.Vector2(1, 1),
                transparent: false,
                opacity: 1.0
              })
              child.geometry.computeVertexNormals()
              break

            case 'wireframe':
              if (!this.originalMaterials.has(child)) {
                this.originalMaterials.set(child, child.material)
              }
              child.material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: false,
                opacity: 1.0
              })
              break

            case 'original':
              const originalMaterial = this.originalMaterials.get(child)
              if (originalMaterial) {
                child.material = originalMaterial
              } else {
                child.material = this.standardMaterial
              }
              break
          }
        }
      })

      this.renderer.outputColorSpace = THREE.SRGBColorSpace
      this.renderer.render(this.scene, this.activeCamera)
    }
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)
    this.lights.push(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(0, 10, 10)
    this.scene.add(mainLight)
    this.lights.push(mainLight)

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5)
    backLight.position.set(0, 10, -10)
    this.scene.add(backLight)
    this.lights.push(backLight)

    const leftFillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    leftFillLight.position.set(-10, 0, 0)
    this.scene.add(leftFillLight)
    this.lights.push(leftFillLight)

    const rightFillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rightFillLight.position.set(10, 0, 0)
    this.scene.add(rightFillLight)
    this.lights.push(rightFillLight)

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.2)
    bottomLight.position.set(0, -10, 0)
    this.scene.add(bottomLight)
    this.lights.push(bottomLight)
  }

  toggleCamera(cameraType?: 'perspective' | 'orthographic') {
    const position = this.activeCamera.position.clone()
    const rotation = this.activeCamera.rotation.clone()
    const target = this.controls.target.clone()

    if (!cameraType) {
      this.activeCamera =
        this.activeCamera === this.perspectiveCamera
          ? this.orthographicCamera
          : this.perspectiveCamera
    } else {
      const requestedCamera =
        cameraType === 'perspective'
          ? this.perspectiveCamera
          : this.orthographicCamera

      if (this.activeCamera === requestedCamera) {
        return
      }

      this.activeCamera = requestedCamera
    }

    this.activeCamera.position.copy(position)
    this.activeCamera.rotation.copy(rotation)

    this.controls.object = this.activeCamera
    this.controls.target.copy(target)
    this.controls.update()

    this.handleResize()
  }

  toggleGrid(showGrid: boolean) {
    if (this.gridHelper) {
      this.gridHelper.visible = showGrid
    }
  }

  setLightIntensity(intensity: number) {
    this.lights.forEach((light) => {
      if (light instanceof THREE.DirectionalLight) {
        if (light === this.lights[1]) {
          light.intensity = intensity * 0.8
        } else if (light === this.lights[2]) {
          light.intensity = intensity * 0.5
        } else if (light === this.lights[5]) {
          light.intensity = intensity * 0.2
        } else {
          light.intensity = intensity * 0.3
        }
      } else if (light instanceof THREE.AmbientLight) {
        light.intensity = intensity * 0.5
      }
    })
  }

  startAnimation() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.activeCamera)
    }
    animate()
  }

  clearModel() {
    if (this.currentAnimation) {
      this.animationActions.forEach((action) => {
        action.stop()
      })
      this.currentAnimation = null
    }
    this.animationActions = []
    this.isAnimationPlaying = false

    const objectsToRemove: THREE.Object3D[] = []

    this.scene.traverse((object) => {
      const isEnvironmentObject =
        object === this.gridHelper ||
        this.lights.includes(object as THREE.Light) ||
        object === this.perspectiveCamera ||
        object === this.orthographicCamera

      if (!isEnvironmentObject) {
        objectsToRemove.push(object)
      }
    })

    objectsToRemove.forEach((obj) => {
      if (obj.parent && obj.parent !== this.scene) {
        obj.parent.remove(obj)
      } else {
        this.scene.remove(obj)
      }

      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((material) => material.dispose())
        } else {
          obj.material?.dispose()
        }
      }
    })

    this.currentModel = null

    const defaultDistance = 10
    this.perspectiveCamera.position.set(
      defaultDistance,
      defaultDistance,
      defaultDistance
    )
    this.orthographicCamera.position.set(
      defaultDistance,
      defaultDistance,
      defaultDistance
    )

    this.perspectiveCamera.lookAt(0, 0, 0)
    this.orthographicCamera.lookAt(0, 0, 0)

    const frustumSize = 10
    const aspect =
      this.renderer.domElement.width / this.renderer.domElement.height
    this.orthographicCamera.left = (-frustumSize * aspect) / 2
    this.orthographicCamera.right = (frustumSize * aspect) / 2
    this.orthographicCamera.top = frustumSize / 2
    this.orthographicCamera.bottom = -frustumSize / 2

    this.perspectiveCamera.updateProjectionMatrix()
    this.orthographicCamera.updateProjectionMatrix()

    this.controls.target.set(0, 0, 0)
    this.controls.update()

    this.renderer.render(this.scene, this.activeCamera)

    this.materialMode = 'original'
    this.originalMaterials = new WeakMap()
  }

  toggleAnimation(play?: boolean) {
    if (!this.currentAnimation || this.animationActions.length === 0) return

    this.isAnimationPlaying = play ?? !this.isAnimationPlaying

    this.animationActions.forEach((action) => {
      action.paused = !this.isAnimationPlaying
    })
  }

  remove() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }

    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.scene.clear()
  }

  async loadModel(url: string, originalFileName?: string) {
    try {
      this.clearModel()

      let fileExtension: string | undefined
      if (originalFileName) {
        fileExtension = originalFileName.split('.').pop()?.toLowerCase()
      } else {
        const filename = new URLSearchParams(url.split('?')[1]).get('filename')
        fileExtension = filename?.split('.').pop()?.toLowerCase()
      }

      if (!fileExtension) {
        useToastStore().addAlert('Could not determine file type')
        return
      }

      let model: THREE.Object3D | null = null

      switch (fileExtension) {
        case 'stl':
          const geometry = await this.stlLoader.loadAsync(url)
          geometry.computeVertexNormals()

          const mesh = new THREE.Mesh(geometry, this.standardMaterial)

          const group = new THREE.Group()
          group.add(mesh)

          model = group
          break

        case 'fbx':
          const fbxModel = await this.fbxLoader.loadAsync(url)
          model = fbxModel

          fbxModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              this.originalMaterials.set(child, child.material)
            }
          })

          if (fbxModel.animations.length > 0) {
            this.currentAnimation = new THREE.AnimationMixer(fbxModel)
            this.animationActions = fbxModel.animations.map((clip) => {
              const action = this.currentAnimation!.clipAction(clip)
              action.clampWhenFinished = true
              action.play()
              action.paused = true
              return action
            })
          }
          break

        case 'obj':
          if (this.materialMode === 'original') {
            const mtlUrl = url.replace(/\.obj([^.]*$)/, '.mtl$1')
            try {
              const materials = await this.mtlLoader.loadAsync(mtlUrl)
              materials.preload()
              this.objLoader.setMaterials(materials)
            } catch (e) {
              console.log(
                'No MTL file found or error loading it, continuing without materials'
              )
            }
          }

          model = await this.objLoader.loadAsync(url)

          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              this.originalMaterials.set(child, child.material)
            }
          })
          break

        case 'gltf':
        case 'glb':
          const gltf = await this.gltfLoader.loadAsync(url)
          model = gltf.scene

          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.computeVertexNormals()
              this.originalMaterials.set(child, child.material)
            }
          })
          break

        default:
          useToastStore().addAlert(`Unsupported file format: ${fileExtension}`)
          return
      }

      if (model) {
        this.currentModel = model

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 5
        const scale = targetSize / maxDim
        model.scale.multiplyScalar(scale)

        box.setFromObject(model)
        box.getCenter(center)
        box.getSize(size)

        model.position.set(-center.x, -box.min.y, -center.z)

        this.scene.add(model)

        if (this.materialMode !== 'original') {
          this.setMaterialMode(this.materialMode)
        }

        const distance = Math.max(size.x, size.z) * 2
        const height = size.y * 2

        this.perspectiveCamera.position.set(distance, height, distance)
        this.orthographicCamera.position.set(distance, height, distance)

        if (this.activeCamera === this.perspectiveCamera) {
          this.perspectiveCamera.lookAt(0, size.y / 2, 0)
          this.perspectiveCamera.updateProjectionMatrix()
        } else {
          const frustumSize = Math.max(size.x, size.y, size.z) * 2
          const aspect =
            this.renderer.domElement.width / this.renderer.domElement.height
          this.orthographicCamera.left = (-frustumSize * aspect) / 2
          this.orthographicCamera.right = (frustumSize * aspect) / 2
          this.orthographicCamera.top = frustumSize / 2
          this.orthographicCamera.bottom = -frustumSize / 2
          this.orthographicCamera.lookAt(0, size.y / 2, 0)
          this.orthographicCamera.updateProjectionMatrix()
        }

        this.controls.target.set(0, size.y / 2, 0)
        this.controls.update()

        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1

        this.handleResize()
      }
    } catch (error) {
      console.error('Error loading model:', error)
    }
  }

  handleResize() {
    const parentElement = this.renderer?.domElement?.parentElement

    if (!parentElement) {
      console.warn('Parent element not found')
      return
    }

    const width = parentElement?.clientWidth
    const height = parentElement?.clientHeight

    if (this.activeCamera === this.perspectiveCamera) {
      this.perspectiveCamera.aspect = width / height
      this.perspectiveCamera.updateProjectionMatrix()
    } else {
      const frustumSize = 10
      const aspect = width / height
      this.orthographicCamera.left = (-frustumSize * aspect) / 2
      this.orthographicCamera.right = (frustumSize * aspect) / 2
      this.orthographicCamera.top = frustumSize / 2
      this.orthographicCamera.bottom = -frustumSize / 2
      this.orthographicCamera.updateProjectionMatrix()
    }

    this.renderer.setSize(width, height)
  }

  animate = () => {
    requestAnimationFrame(this.animate)

    if (this.currentAnimation && this.isAnimationPlaying) {
      const delta = this.clock.getDelta()
      this.currentAnimation.update(delta)
    }

    this.controls.update()
    this.renderer.render(this.scene, this.activeCamera)
  }

  captureScene(width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const originalWidth = this.renderer.domElement.width
        const originalHeight = this.renderer.domElement.height

        this.renderer.setSize(width, height)

        if (this.activeCamera === this.perspectiveCamera) {
          this.perspectiveCamera.aspect = width / height
          this.perspectiveCamera.updateProjectionMatrix()
        } else {
          const frustumSize = 10
          const aspect = width / height
          this.orthographicCamera.left = (-frustumSize * aspect) / 2
          this.orthographicCamera.right = (frustumSize * aspect) / 2
          this.orthographicCamera.top = frustumSize / 2
          this.orthographicCamera.bottom = -frustumSize / 2
          this.orthographicCamera.updateProjectionMatrix()
        }

        this.renderer.render(this.scene, this.activeCamera)

        const imageData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setSize(originalWidth, originalHeight)
        this.handleResize()

        resolve(imageData)
      } catch (error) {
        reject(error)
      }
    })
  }

  createSTLMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.1,
      roughness: 0.8,
      flatShading: false,
      side: THREE.DoubleSide
    })
  }

  setViewPosition(position: 'front' | 'top' | 'right' | 'isometric') {
    const box = new THREE.Box3()
    let center = new THREE.Vector3()
    let size = new THREE.Vector3()

    if (this.currentModel) {
      box.setFromObject(this.currentModel)
      box.getCenter(center)
      box.getSize(size)
    }

    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2

    switch (position) {
      case 'front':
        this.activeCamera.position.set(0, 0, distance)
        break
      case 'top':
        this.activeCamera.position.set(0, distance, 0)
        break
      case 'right':
        this.activeCamera.position.set(distance, 0, 0)
        break
      case 'isometric':
        this.activeCamera.position.set(distance, distance, distance)
        break
    }

    this.activeCamera.lookAt(center)
    this.controls.target.copy(center)
    this.controls.update()
  }

  setBackgroundColor(color: string) {
    this.renderer.setClearColor(new THREE.Color(color))
    this.renderer.render(this.scene, this.activeCamera)
  }
}

function splitFilePath(path: string): [string, string] {
  const folder_separator = path.lastIndexOf('/')
  if (folder_separator === -1) {
    return ['', path]
  }
  return [
    path.substring(0, folder_separator),
    path.substring(folder_separator + 1)
  ]
}

function getResourceURL(
  subfolder: string,
  filename: string,
  type: string = 'input'
): string {
  const params = [
    'filename=' + encodeURIComponent(filename),
    'type=' + type,
    'subfolder=' + subfolder,
    app.getRandParam().substring(1)
  ].join('&')

  return `/view?${params}`
}

const containerToLoad3D = new Map()

app.registerExtension({
  name: 'Comfy.Load3D',

  getCustomWidgets(app) {
    return {
      LOAD_3D(node, inputName) {
        let load3dNode = app.graph._nodes.filter((wi) => wi.type == 'Load3D')

        const container = document.createElement('div')
        container.id = `comfy-load-3d-${load3dNode.length}`
        container.classList.add('comfy-load-3d')

        const load3d = new Load3d(container)

        containerToLoad3D.set(container.id, load3d)

        node.onResize = function () {
          if (load3d) {
            load3d.handleResize()
          }
        }

        const origOnRemoved = node.onRemoved

        node.onRemoved = function () {
          if (load3d) {
            load3d.remove()
          }

          containerToLoad3D.delete(container.id)

          origOnRemoved?.apply(this, [])
        }

        node.onDrawBackground = function () {
          load3d.renderer.domElement.hidden = this.flags.collapsed ?? false
        }

        return {
          widget: node.addDOMWidget(inputName, 'LOAD_3D', container)
        }
      }
    }
  },

  init() {
    const style = document.createElement('style')

    style.innerText = `
        .comfy-load-3d {
          display: flex;
          flex-direction: column;
          background: transparent;
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        
        .comfy-load-3d canvas {
          width: 100% !important;
          height: 100% !important;
        }
      `
    document.head.appendChild(style)
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const [oldWidth, oldHeight] = node.size

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const onModelWidgetUpdate = () => {
      if (modelWidget.value) {
        const filename = modelWidget.value
        const modelUrl = api.apiURL(getResourceURL(...splitFilePath(filename)))

        load3d.loadModel(modelUrl, filename)

        const material = node.widgets.find(
          (w: IWidget) => w.name === 'material'
        )

        load3d.setMaterialMode(material.value)
      }
    }

    if (modelWidget.value) {
      onModelWidgetUpdate()
    }

    modelWidget.callback = onModelWidgetUpdate

    const showGrid = node.widgets.find((w: IWidget) => w.name === 'show_grid')

    load3d.toggleGrid(showGrid.value)

    showGrid.callback = (value: boolean) => {
      load3d.toggleGrid(value)
    }

    const cameraType = node.widgets.find(
      (w: IWidget) => w.name === 'camera_type'
    )

    load3d.toggleCamera(cameraType.value)

    cameraType.callback = (value: 'perspective' | 'orthographic') => {
      load3d.toggleCamera(value)
    }

    const view = node.widgets.find((w: IWidget) => w.name === 'view')

    view.callback = (value: 'front' | 'top' | 'right' | 'isometric') => {
      load3d.setViewPosition(value)
    }

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    material.callback = (value: 'original' | 'normal' | 'wireframe') => {
      load3d.setMaterialMode(value)
    }

    load3d.setMaterialMode(material.value)

    const bgColor = node.widgets.find((w: IWidget) => w.name === 'bg_color')

    load3d.setBackgroundColor(bgColor.value)

    bgColor.callback = (value: string) => {
      load3d.setBackgroundColor(value)
    }

    const lightIntensity = node.widgets.find(
      (w: IWidget) => w.name === 'light_intensity'
    )

    load3d.setLightIntensity(lightIntensity.value)

    lightIntensity.callback = (value: number) => {
      load3d.setLightIntensity(value)
    }

    const w = node.widgets.find((w: IWidget) => w.name === 'width')
    const h = node.widgets.find((w: IWidget) => w.name === 'height')

    sceneWidget.serializeValue = async () => {
      load3d.toggleAnimation(false)

      const imageData = await load3d.captureScene(w.value, h.value)

      const blob = await fetch(imageData).then((r) => r.blob())
      const name = `scene_${Date.now()}.png`
      const file = new File([blob], name)

      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'threed')
      body.append('type', 'temp')

      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })

      if (resp.status !== 200) {
        const err = `Error uploading scene capture: ${resp.status} - ${resp.statusText}`
        useToastStore().addAlert(err)
        throw new Error(err)
      }

      const data = await resp.json()
      return `threed/${data.name} [temp]`
    }

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.gltf,.glb,.obj,.mtl,.fbx,.stl'
    fileInput.style.display = 'none'
    fileInput.onchange = () => {
      if (fileInput.files?.length) {
        const modelWidget = node.widgets.find(
          (w: IWidget) => w.name === 'model_file'
        )
        uploadFile(
          modelWidget,
          load3d,
          fileInput.files[0],
          true,
          fileInput
        ).catch((error) => {
          console.error('File upload failed:', error)
          useToastStore().addAlert('File upload failed')
        })
      }
    }

    node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
      fileInput.click()
    })

    node.addWidget('button', 'clear', 'clear', () => {
      load3d.clearModel()
      const modelWidget = node.widgets.find(
        (w: IWidget) => w.name === 'model_file'
      )
      if (modelWidget) {
        modelWidget.value = ''
      }
    })

    node.addWidget('button', 'Play/Pause Animation', 'toggle_animation', () => {
      load3d.toggleAnimation()
    })

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 550)])
  }
})
