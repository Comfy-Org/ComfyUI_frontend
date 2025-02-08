import { LGraphNode } from '@comfyorg/litegraph'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { App, createApp } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import { useToastStore } from '@/stores/toastStore'

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
  originalModel: THREE.Object3D | THREE.BufferGeometry | GLTF | null = null
  animationFrameId: number | null = null
  gridHelper: THREE.GridHelper
  lights: THREE.Light[] = []
  clock: THREE.Clock
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  depthMaterial: THREE.MeshDepthMaterial
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]> =
    new WeakMap()

  materialMode: 'original' | 'normal' | 'wireframe' | 'depth' = 'original'
  currentUpDirection: 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z' =
    'original'
  originalRotation: THREE.Euler | null = null
  viewHelper: ViewHelper = {} as ViewHelper
  viewHelperContainer: HTMLDivElement = {} as HTMLDivElement
  cameraSwitcherContainer: HTMLDivElement = {} as HTMLDivElement
  gridSwitcherContainer: HTMLDivElement = {} as HTMLDivElement
  node: LGraphNode = {} as LGraphNode

  protected controlsApp: App | null = null
  protected controlsContainer: HTMLDivElement

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

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    this.renderer.setSize(300, 300)
    this.renderer.setClearColor(0x282828)
    this.renderer.autoClear = false

    const rendererDomElement: HTMLCanvasElement = this.renderer.domElement

    container.appendChild(rendererDomElement)

    this.controls = new OrbitControls(
      this.activeCamera,
      this.renderer.domElement
    )
    this.controls.enableDamping = true

    this.controls.addEventListener('end', () => {
      this.storeNodeProperty('Camera Info', this.getCameraState())
    })

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

    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
      side: THREE.DoubleSide
    })

    this.standardMaterial = this.createSTLMaterial()

    this.createViewHelper(container)

    this.controlsContainer = document.createElement('div')
    this.controlsContainer.style.position = 'absolute'
    this.controlsContainer.style.top = '0'
    this.controlsContainer.style.left = '0'
    this.controlsContainer.style.width = '100%'
    this.controlsContainer.style.height = '100%'
    this.controlsContainer.style.pointerEvents = 'none'
    this.controlsContainer.style.zIndex = '1'
    container.appendChild(this.controlsContainer)

    this.mountControls()

    this.handleResize()

    this.startAnimation()
  }

  protected mountControls() {
    const controlsMount = document.createElement('div')
    controlsMount.style.pointerEvents = 'auto'
    this.controlsContainer.appendChild(controlsMount)

    this.controlsApp = createApp(Load3DControls, {
      backgroundColor: '#282828',
      showGrid: true,
      onToggleCamera: () => this.toggleCamera(),
      onToggleGrid: (show: boolean) => this.toggleGrid(show),
      onUpdateBackgroundColor: (color: string) => this.setBackgroundColor(color)
    })

    this.controlsApp.mount(controlsMount)
  }

  setNode(node: LGraphNode) {
    this.node = node
  }

  storeNodeProperty(name: string, value: any) {
    if (this.node) {
      this.node.properties[name] = value
    }
  }

  loadNodeProperty(name: string, defaultValue: any) {
    if (
      !this.node ||
      !this.node.properties ||
      !(name in this.node.properties)
    ) {
      return defaultValue
    }
    return this.node.properties[name]
  }

  createViewHelper(container: Element | HTMLElement) {
    this.viewHelperContainer = document.createElement('div')

    this.viewHelperContainer.style.position = 'absolute'
    this.viewHelperContainer.style.bottom = '0'
    this.viewHelperContainer.style.left = '0'
    this.viewHelperContainer.style.width = '128px'
    this.viewHelperContainer.style.height = '128px'
    this.viewHelperContainer.addEventListener('pointerup', (event) => {
      event.stopPropagation()

      this.viewHelper.handleClick(event)
    })

    this.viewHelperContainer.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    container.appendChild(this.viewHelperContainer)

    this.viewHelper = new ViewHelper(
      this.activeCamera,
      this.viewHelperContainer
    )

    this.viewHelper.center = this.controls.target
  }

  setFOV(fov: number) {
    if (this.activeCamera === this.perspectiveCamera) {
      this.perspectiveCamera.fov = fov
      this.perspectiveCamera.updateProjectionMatrix()
      this.renderer.render(this.scene, this.activeCamera)
    }
  }

  getCameraState() {
    const currentType = this.getCurrentCameraType()
    return {
      position: this.activeCamera.position.clone(),
      target: this.controls.target.clone(),
      zoom:
        this.activeCamera instanceof THREE.OrthographicCamera
          ? this.activeCamera.zoom
          : (this.activeCamera as THREE.PerspectiveCamera).zoom,
      cameraType: currentType
    }
  }

  setCameraState(state: {
    position: THREE.Vector3
    target: THREE.Vector3
    zoom: number
    cameraType: 'perspective' | 'orthographic'
  }) {
    this.activeCamera.position.copy(state.position)

    this.controls.target.copy(state.target)

    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      this.activeCamera.zoom = state.zoom
      this.activeCamera.updateProjectionMatrix()
    } else if (this.activeCamera instanceof THREE.PerspectiveCamera) {
      this.activeCamera.zoom = state.zoom
      this.activeCamera.updateProjectionMatrix()
    }

    this.controls.update()
  }

  setUpDirection(
    direction: 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
  ) {
    if (!this.currentModel) return

    if (!this.originalRotation && this.currentModel.rotation) {
      this.originalRotation = this.currentModel.rotation.clone()
    }

    this.currentUpDirection = direction

    if (this.originalRotation) {
      this.currentModel.rotation.copy(this.originalRotation)
    }

    switch (direction) {
      case 'original':
        break
      case '-x':
        this.currentModel.rotation.z = Math.PI / 2
        break
      case '+x':
        this.currentModel.rotation.z = -Math.PI / 2
        break
      case '-y':
        this.currentModel.rotation.x = Math.PI
        break
      case '+y':
        break
      case '-z':
        this.currentModel.rotation.x = Math.PI / 2
        break
      case '+z':
        this.currentModel.rotation.x = -Math.PI / 2
        break
    }

    this.renderer.render(this.scene, this.activeCamera)
  }

  setMaterialMode(mode: 'original' | 'normal' | 'wireframe' | 'depth') {
    this.materialMode = mode

    if (this.currentModel) {
      if (mode === 'depth') {
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
      } else {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
      }

      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          switch (mode) {
            case 'depth':
              if (!this.originalMaterials.has(child)) {
                this.originalMaterials.set(child, child.material)
              }
              const depthMat = new THREE.MeshDepthMaterial({
                depthPacking: THREE.BasicDepthPacking,
                side: THREE.DoubleSide
              })

              depthMat.onBeforeCompile = (shader) => {
                shader.uniforms.cameraType = {
                  value:
                    this.activeCamera instanceof THREE.OrthographicCamera
                      ? 1.0
                      : 0.0
                }

                shader.fragmentShader = `
                  uniform float cameraType;
                  ${shader.fragmentShader}
                `

                shader.fragmentShader = shader.fragmentShader.replace(
                  /gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*1.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\)\s*;/,
                  `
                    float depth = 1.0 - fragCoordZ;
                    if (cameraType > 0.5) {
                      depth = pow(depth, 400.0);
                    } else {
                      depth = pow(depth, 0.6);
                    }
                    gl_FragColor = vec4(vec3(depth), opacity);
                  `
                )
              }

              depthMat.customProgramCacheKey = () => {
                return this.activeCamera instanceof THREE.OrthographicCamera
                  ? 'ortho'
                  : 'persp'
              }

              child.material = depthMat
              break
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
    const oldCamera = this.activeCamera

    const position = oldCamera.position.clone()
    const rotation = oldCamera.rotation.clone()
    const target = this.controls.target.clone()

    if (!cameraType) {
      this.activeCamera =
        oldCamera === this.perspectiveCamera
          ? this.orthographicCamera
          : this.perspectiveCamera
    } else {
      this.activeCamera =
        cameraType === 'perspective'
          ? this.perspectiveCamera
          : this.orthographicCamera

      if (oldCamera === this.activeCamera) {
        return
      }
    }

    this.activeCamera.position.copy(position)
    this.activeCamera.rotation.copy(rotation)

    if (this.materialMode === 'depth' && oldCamera !== this.activeCamera) {
      this.setMaterialMode('depth')
    }

    this.controls.object = this.activeCamera
    this.controls.target.copy(target)
    this.controls.update()

    this.viewHelper.dispose()
    this.viewHelper = new ViewHelper(
      this.activeCamera,
      this.viewHelperContainer
    )
    this.viewHelper.center = this.controls.target

    this.storeNodeProperty('Camera Type', this.getCurrentCameraType())
    this.handleResize()
  }

  getCurrentCameraType(): 'perspective' | 'orthographic' {
    return this.activeCamera === this.perspectiveCamera
      ? 'perspective'
      : 'orthographic'
  }

  toggleGrid(showGrid: boolean) {
    if (this.gridHelper) {
      this.gridHelper.visible = showGrid

      this.storeNodeProperty('Show Grid', showGrid)
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
      const delta = this.clock.getDelta()

      if (this.viewHelper.animating) {
        this.viewHelper.update(delta)

        if (!this.viewHelper.animating) {
          this.storeNodeProperty('Camera Info', this.getCameraState())
        }
      }

      this.renderer.clear()
      this.controls.update()
      this.renderer.render(this.scene, this.activeCamera)
      this.viewHelper.render(this.renderer)
    }
    animate()
  }

  clearModel() {
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

    this.resetScene()
  }

  protected resetScene() {
    this.currentModel = null
    this.originalRotation = null

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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  remove() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }

    this.controls.dispose()
    this.viewHelper.dispose()
    this.renderer.dispose()
    if (this.controlsApp) {
      this.controlsApp.unmount()
      this.controlsApp = null
    }
    this.renderer.domElement.remove()
    this.scene.clear()
  }

  protected async loadModelInternal(
    url: string,
    fileExtension: string
  ): Promise<THREE.Object3D | null> {
    let model: THREE.Object3D | null = null

    switch (fileExtension) {
      case 'stl':
        const geometry = await this.stlLoader.loadAsync(url)

        this.originalModel = geometry

        geometry.computeVertexNormals()
        const mesh = new THREE.Mesh(geometry, this.standardMaterial)
        const group = new THREE.Group()
        group.add(mesh)
        model = group
        break

      case 'fbx':
        const fbxModel = await this.fbxLoader.loadAsync(url)

        this.originalModel = fbxModel

        model = fbxModel

        fbxModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            this.originalMaterials.set(child, child.material)
          }
        })

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

        this.originalModel = gltf

        model = gltf.scene
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.computeVertexNormals()
            this.originalMaterials.set(child, child.material)
          }
        })
        break
    }

    return model
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

      let model = await this.loadModelInternal(url, fileExtension)

      if (model) {
        this.currentModel = model
        await this.setupModel(model)
      }
    } catch (error) {
      console.error('Error loading model:', error)
    }
  }

  protected async setupModel(model: THREE.Object3D) {
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

    if (this.currentUpDirection !== 'original') {
      this.setUpDirection(this.currentUpDirection)
    }

    await this.setupCamera(size)
  }

  protected async setupCamera(size: THREE.Vector3) {
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

  refreshViewport() {
    this.handleResize()
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

    this.controls.update()
    this.renderer.render(this.scene, this.activeCamera)
  }

  captureScene(
    width: number,
    height: number
  ): Promise<{ scene: string; mask: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const originalWidth = this.renderer.domElement.width
        const originalHeight = this.renderer.domElement.height
        const originalClearColor = this.renderer.getClearColor(
          new THREE.Color()
        )
        const originalClearAlpha = this.renderer.getClearAlpha()

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

        this.renderer.clear()
        this.renderer.render(this.scene, this.activeCamera)
        const sceneData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setClearColor(0x000000, 0)
        this.renderer.clear()
        this.renderer.render(this.scene, this.activeCamera)
        const maskData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setClearColor(originalClearColor, originalClearAlpha)
        this.renderer.setSize(originalWidth, originalHeight)
        this.handleResize()

        resolve({ scene: sceneData, mask: maskData })
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

  setBackgroundColor(color: string) {
    this.renderer.setClearColor(new THREE.Color(color))
    this.renderer.render(this.scene, this.activeCamera)

    if (this.controlsApp?._instance?.exposed) {
      this.controlsApp._instance.exposed.backgroundColor.value = color
    }

    this.storeNodeProperty('Background Color', color)
  }
}

export default Load3d
