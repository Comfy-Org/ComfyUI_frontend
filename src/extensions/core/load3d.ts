// @ts-strict-ignore
import { IWidget } from '@comfyorg/litegraph'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useToastStore } from '@/stores/toastStore'

async function uploadTempImage(imageData, prefix) {
  const blob = await fetch(imageData).then((r) => r.blob())
  const name = `${prefix}_${Date.now()}.png`
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
    const err = `Error uploading temp image: ${resp.status} - ${resp.statusText}`
    useToastStore().addAlert(err)
    throw new Error(err)
  }

  return await resp.json()
}

async function uploadFile(
  load3d: Load3d,
  file: File,
  fileInput?: HTMLInputElement
) {
  let uploadPath

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

      uploadPath = path

      const modelUrl = api.apiURL(
        getResourceURL(...splitFilePath(path), 'input')
      )
      await load3d.loadModel(modelUrl, file.name)

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

  return uploadPath
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
  viewHelper: ViewHelper
  viewHelperContainer: HTMLDivElement
  cameraSwitcherContainer: HTMLDivElement
  gridSwitcherContainer: HTMLDivElement

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

    this.createGridSwitcher(container)

    this.createCameraSwitcher(container)

    this.handleResize()

    this.startAnimation()
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

  createGridSwitcher(container: Element | HTMLElement) {
    this.gridSwitcherContainer = document.createElement('div')
    this.gridSwitcherContainer.style.position = 'absolute'
    this.gridSwitcherContainer.style.top = '28px' // 修改这里，让按钮在相机按钮下方
    this.gridSwitcherContainer.style.left = '3px' // 与相机按钮左对齐
    this.gridSwitcherContainer.style.width = '20px'
    this.gridSwitcherContainer.style.height = '20px'
    this.gridSwitcherContainer.style.cursor = 'pointer'
    this.gridSwitcherContainer.style.alignItems = 'center'
    this.gridSwitcherContainer.style.justifyContent = 'center'
    this.gridSwitcherContainer.style.transition = 'background-color 0.2s'

    const gridIcon = document.createElement('div')
    gridIcon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M3 3h18v18H3z"/>
      <path d="M3 9h18"/>
      <path d="M3 15h18"/>
      <path d="M9 3v18"/>
      <path d="M15 3v18"/>
    </svg>
  `

    const updateButtonState = () => {
      if (this.gridHelper.visible) {
        this.gridSwitcherContainer.style.backgroundColor =
          'rgba(255, 255, 255, 0.2)'
      } else {
        this.gridSwitcherContainer.style.backgroundColor = 'transparent'
      }
    }

    updateButtonState()

    this.gridSwitcherContainer.addEventListener('mouseenter', () => {
      if (!this.gridHelper.visible) {
        this.gridSwitcherContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
      }
    })

    this.gridSwitcherContainer.addEventListener('mouseleave', () => {
      if (!this.gridHelper.visible) {
        this.gridSwitcherContainer.style.backgroundColor = 'transparent'
      }
    })

    this.gridSwitcherContainer.title = 'Toggle Grid'

    this.gridSwitcherContainer.addEventListener('click', (event) => {
      event.stopPropagation()
      this.toggleGrid(!this.gridHelper.visible)
      updateButtonState()
    })

    this.gridSwitcherContainer.appendChild(gridIcon)
    container.appendChild(this.gridSwitcherContainer)
  }

  createCameraSwitcher(container: Element | HTMLElement) {
    this.cameraSwitcherContainer = document.createElement('div')
    this.cameraSwitcherContainer.style.position = 'absolute'
    this.cameraSwitcherContainer.style.top = '3px'
    this.cameraSwitcherContainer.style.left = '3px'
    this.cameraSwitcherContainer.style.width = '20px'
    this.cameraSwitcherContainer.style.height = '20px'
    this.cameraSwitcherContainer.style.cursor = 'pointer'
    this.cameraSwitcherContainer.style.alignItems = 'center'
    this.cameraSwitcherContainer.style.justifyContent = 'center'

    const cameraIcon = document.createElement('div')
    cameraIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/>
        <path d="m12 12 4-2.4"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `
    this.cameraSwitcherContainer.addEventListener('mouseenter', () => {
      this.cameraSwitcherContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    })

    this.cameraSwitcherContainer.addEventListener('mouseleave', () => {
      this.cameraSwitcherContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'
    })

    this.cameraSwitcherContainer.title =
      'Switch Camera (Perspective/Orthographic)'

    this.cameraSwitcherContainer.addEventListener('click', (event) => {
      event.stopPropagation()
      this.toggleCamera()
    })

    this.cameraSwitcherContainer.appendChild(cameraIcon)

    container.appendChild(this.cameraSwitcherContainer)
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
    if (
      this.activeCamera !==
      (state.cameraType === 'perspective'
        ? this.perspectiveCamera
        : this.orthographicCamera)
    ) {
      this.toggleCamera(state.cameraType)
    }

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
  }
}

class Load3dAnimation extends Load3d {
  currentAnimation: THREE.AnimationMixer | null = null
  animationActions: THREE.AnimationAction[] = []
  animationClips: THREE.AnimationClip[] = []
  selectedAnimationIndex: number = 0
  isAnimationPlaying: boolean = false

  animationSpeed: number = 1.0

  constructor(container: Element | HTMLElement) {
    super(container)
  }

  protected async setupModel(model: THREE.Object3D) {
    await super.setupModel(model)

    if (this.currentAnimation) {
      this.currentAnimation.stopAllAction()
      this.animationActions = []
    }

    let animations: THREE.AnimationClip[] = []
    if (model.animations?.length > 0) {
      animations = model.animations
    } else if (this.originalModel && 'animations' in this.originalModel) {
      animations = (
        this.originalModel as unknown as { animations: THREE.AnimationClip[] }
      ).animations
    }

    if (animations.length > 0) {
      this.animationClips = animations
      if (model.type === 'Scene') {
        this.currentAnimation = new THREE.AnimationMixer(model)
      } else {
        this.currentAnimation = new THREE.AnimationMixer(this.currentModel!)
      }

      if (this.animationClips.length > 0) {
        this.updateSelectedAnimation(0)
      }
    }
  }

  setAnimationSpeed(speed: number) {
    this.animationSpeed = speed
    this.animationActions.forEach((action) => {
      action.setEffectiveTimeScale(speed)
    })
  }

  updateSelectedAnimation(index: number) {
    if (
      !this.currentAnimation ||
      !this.animationClips ||
      index >= this.animationClips.length
    ) {
      console.warn('Invalid animation update request')
      return
    }

    this.animationActions.forEach((action) => {
      action.stop()
    })
    this.currentAnimation.stopAllAction()
    this.animationActions = []

    this.selectedAnimationIndex = index
    const clip = this.animationClips[index]

    const action = this.currentAnimation.clipAction(clip)

    action.setEffectiveTimeScale(this.animationSpeed)

    action.reset()
    action.clampWhenFinished = false
    action.loop = THREE.LoopRepeat

    if (this.isAnimationPlaying) {
      action.play()
    } else {
      action.play()
      action.paused = true
    }

    this.animationActions = [action]
  }

  clearModel() {
    if (this.currentAnimation) {
      this.animationActions.forEach((action) => {
        action.stop()
      })
      this.currentAnimation = null
    }
    this.animationActions = []
    this.animationClips = []
    this.selectedAnimationIndex = 0
    this.isAnimationPlaying = false
    this.animationSpeed = 1.0

    super.clearModel()
  }

  getAnimationNames(): string[] {
    return this.animationClips.map((clip, index) => {
      return clip.name || `Animation ${index + 1}`
    })
  }

  toggleAnimation(play?: boolean) {
    if (!this.currentAnimation || this.animationActions.length === 0) {
      console.warn('No animation to toggle')
      return
    }

    this.isAnimationPlaying = play ?? !this.isAnimationPlaying

    this.animationActions.forEach((action) => {
      if (this.isAnimationPlaying) {
        action.paused = false
        if (action.time === 0 || action.time === action.getClip().duration) {
          action.reset()
        }
      } else {
        action.paused = true
      }
    })
  }

  startAnimation() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      const delta = this.clock.getDelta()

      if (this.currentAnimation && this.isAnimationPlaying) {
        this.currentAnimation.update(delta)
      }

      this.controls.update()

      this.renderer.clear()

      this.renderer.render(this.scene, this.activeCamera)

      if (this.viewHelper.animating) {
        this.viewHelper.update(delta)
      }

      this.viewHelper.render(this.renderer)
    }
    animate()
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

const load3dCSSCLASS = `display: flex;
    flex-direction: column;
    background: transparent;
    flex: 1;
    position: relative;
    overflow: hidden;`

const load3dCanvasCSSCLASS = `display: flex;
    width: 100% !important;
    height: 100% !important;`

const containerToLoad3D = new Map()

function configureLoad3D(
  load3d: Load3d,
  loadFolder: 'input' | 'output',
  modelWidget: IWidget,
  material: IWidget,
  bgColor: IWidget,
  lightIntensity: IWidget,
  upDirection: IWidget,
  fov: IWidget,
  cameraState?: any,
  postModelUpdateFunc?: (load3d: Load3d) => void
) {
  const createModelUpdateHandler = () => {
    let isFirstLoad = true

    return async (value: string | number | boolean | object) => {
      if (!value) return

      const filename = value as string
      const modelUrl = api.apiURL(
        getResourceURL(...splitFilePath(filename), loadFolder)
      )

      await load3d.loadModel(modelUrl, filename)

      load3d.setMaterialMode(
        material.value as 'original' | 'normal' | 'wireframe'
      )

      load3d.setUpDirection(
        upDirection.value as
          | 'original'
          | '-x'
          | '+x'
          | '-y'
          | '+y'
          | '-z'
          | '+z'
      )

      if (postModelUpdateFunc) {
        postModelUpdateFunc(load3d)
      }

      if (isFirstLoad && cameraState && typeof cameraState === 'object') {
        try {
          load3d.setCameraState(cameraState)
        } catch (error) {
          console.warn('Failed to restore camera state:', error)
        }
        isFirstLoad = false
      }
    }
  }

  const onModelWidgetUpdate = createModelUpdateHandler()

  if (modelWidget.value) {
    onModelWidgetUpdate(modelWidget.value)
  }

  modelWidget.callback = onModelWidgetUpdate

  material.callback = (value: 'original' | 'normal' | 'wireframe') => {
    load3d.setMaterialMode(value)
  }

  load3d.setMaterialMode(material.value as 'original' | 'normal' | 'wireframe')

  load3d.setBackgroundColor(bgColor.value as string)

  bgColor.callback = (value: string) => {
    load3d.setBackgroundColor(value)
  }

  load3d.setLightIntensity(lightIntensity.value as number)

  lightIntensity.callback = (value: number) => {
    load3d.setLightIntensity(value)
  }

  upDirection.callback = (
    value: 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
  ) => {
    load3d.setUpDirection(value)
  }

  load3d.setUpDirection(
    upDirection.value as 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
  )

  fov.callback = (value: number) => {
    load3d.setFOV(value)
  }

  load3d.setFOV(fov.value as number)
}

app.registerExtension({
  name: 'Comfy.Load3D',

  getCustomWidgets(app) {
    return {
      LOAD_3D(node, inputName) {
        let load3dNode = app.graph._nodes.filter((wi) => wi.type == 'Load3D')

        node.addProperty('Camera Info', '')

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

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.gltf,.glb,.obj,.mtl,.fbx,.stl'
        fileInput.style.display = 'none'
        fileInput.onchange = async () => {
          if (fileInput.files?.length) {
            const modelWidget = node.widgets?.find(
              (w: IWidget) => w.name === 'model_file'
            )
            const uploadPath = await uploadFile(
              load3d,
              fileInput.files[0],
              fileInput
            ).catch((error) => {
              console.error('File upload failed:', error)
              useToastStore().addAlert('File upload failed')
            })

            if (uploadPath && modelWidget) {
              if (!modelWidget.options?.values?.includes(uploadPath)) {
                modelWidget.options?.values?.push(uploadPath)
              }

              modelWidget.value = uploadPath
            }
          }
        }

        node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
          fileInput.click()
        })

        node.addWidget('button', 'clear', 'clear', () => {
          load3d.clearModel()
          const modelWidget = node.widgets?.find(
            (w: IWidget) => w.name === 'model_file'
          )
          if (modelWidget) {
            modelWidget.value = ''
          }
        })

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
          ${load3dCSSCLASS}
        }
        
        .comfy-load-3d canvas {
          ${load3dCanvasCSSCLASS}
        }
      `
    document.head.appendChild(style)
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 600)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const bgColor = node.widgets.find((w: IWidget) => w.name === 'bg_color')

    const lightIntensity = node.widgets.find(
      (w: IWidget) => w.name === 'light_intensity'
    )

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

    const fov = node.widgets.find((w: IWidget) => w.name === 'fov')

    let cameraState
    try {
      const cameraInfo = node.properties['Camera Info']
      if (
        cameraInfo &&
        typeof cameraInfo === 'string' &&
        cameraInfo.trim() !== ''
      ) {
        cameraState = JSON.parse(cameraInfo)
      }
    } catch (error) {
      console.warn('Failed to parse camera state:', error)
      cameraState = undefined
    }

    configureLoad3D(
      load3d,
      'input',
      modelWidget,
      material,
      bgColor,
      lightIntensity,
      upDirection,
      fov,
      cameraState
    )

    const w = node.widgets.find((w: IWidget) => w.name === 'width')
    const h = node.widgets.find((w: IWidget) => w.name === 'height')

    // @ts-expect-error hacky override
    sceneWidget.serializeValue = async () => {
      node.properties['Camera Info'] = JSON.stringify(load3d.getCameraState())

      const { scene: imageData, mask: maskData } = await load3d.captureScene(
        w.value,
        h.value
      )

      const [data, dataMask] = await Promise.all([
        uploadTempImage(imageData, 'scene'),
        uploadTempImage(maskData, 'scene_mask')
      ])

      return {
        image: `threed/${data.name} [temp]`,
        mask: `threed/${dataMask.name} [temp]`
      }
    }
  }
})

app.registerExtension({
  name: 'Comfy.Load3DAnimation',

  getCustomWidgets(app) {
    return {
      LOAD_3D_ANIMATION(node, inputName) {
        let load3dNode = app.graph._nodes.filter(
          (wi) => wi.type == 'Load3DAnimation'
        )

        node.addProperty('Camera Info', '')

        const container = document.createElement('div')
        container.id = `comfy-load-3d-animation-${load3dNode.length}`
        container.classList.add('comfy-load-3d-animation')

        const load3d = new Load3dAnimation(container)

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

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.fbx,glb,gltf'
        fileInput.style.display = 'none'
        fileInput.onchange = async () => {
          if (fileInput.files?.length) {
            const modelWidget = node.widgets?.find(
              (w: IWidget) => w.name === 'model_file'
            )
            const uploadPath = await uploadFile(
              load3d,
              fileInput.files[0],
              fileInput
            ).catch((error) => {
              console.error('File upload failed:', error)
              useToastStore().addAlert('File upload failed')
            })

            if (uploadPath && modelWidget) {
              if (!modelWidget.options?.values?.includes(uploadPath)) {
                modelWidget.options?.values?.push(uploadPath)
              }

              modelWidget.value = uploadPath
            }
          }
        }

        node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
          fileInput.click()
        })

        node.addWidget('button', 'clear', 'clear', () => {
          load3d.clearModel()
          const modelWidget = node.widgets?.find(
            (w: IWidget) => w.name === 'model_file'
          )
          if (modelWidget) {
            modelWidget.value = ''
          }

          const animationSelect = node.widgets?.find(
            (w: IWidget) => w.name === 'animation'
          )

          if (animationSelect) {
            animationSelect.options.values = []
            animationSelect.value = ''
          }

          const speedSelect = node.widgets?.find(
            (w: IWidget) => w.name === 'animation_speed'
          )

          if (speedSelect) {
            speedSelect.value = '1'
          }
        })

        node.addWidget(
          'button',
          'Play/Pause Animation',
          'toggle_animation',
          () => {
            load3d.toggleAnimation()
          }
        )

        const animationSelect = node.addWidget(
          'combo',
          'animation',
          '',
          () => '',
          {
            values: []
          }
        ) as IWidget

        animationSelect.callback = (value: string) => {
          const names = load3d.getAnimationNames()
          const index = names.indexOf(value)

          if (index !== -1) {
            const wasPlaying = load3d.isAnimationPlaying

            if (wasPlaying) {
              load3d.toggleAnimation(false)
            }

            load3d.updateSelectedAnimation(index)

            if (wasPlaying) {
              load3d.toggleAnimation(true)
            }
          }
        }

        return {
          widget: node.addDOMWidget(inputName, 'LOAD_3D_ANIMATION', container)
        }
      }
    }
  },

  init() {
    const style = document.createElement('style')

    style.innerText = `
        .comfy-load-3d-animation {
          ${load3dCSSCLASS}
        }
        
        .comfy-load-3d-animation canvas {
          ${load3dCanvasCSSCLASS}
        }
      `
    document.head.appendChild(style)
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 700)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const bgColor = node.widgets.find((w: IWidget) => w.name === 'bg_color')

    const lightIntensity = node.widgets.find(
      (w: IWidget) => w.name === 'light_intensity'
    )

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

    const speedSelect = node.widgets.find(
      (w: IWidget) => w.name === 'animation_speed'
    )

    speedSelect.callback = (value: string) => {
      const load3d = containerToLoad3D.get(container.id) as Load3dAnimation
      if (load3d) {
        load3d.setAnimationSpeed(parseFloat(value))
      }
    }

    const fov = node.widgets.find((w: IWidget) => w.name === 'fov')

    let cameraState
    try {
      const cameraInfo = node.properties['Camera Info']
      if (
        cameraInfo &&
        typeof cameraInfo === 'string' &&
        cameraInfo.trim() !== ''
      ) {
        cameraState = JSON.parse(cameraInfo)
      }
    } catch (error) {
      console.warn('Failed to parse camera state:', error)
      cameraState = undefined
    }

    configureLoad3D(
      load3d,
      'input',
      modelWidget,
      material,
      bgColor,
      lightIntensity,
      upDirection,
      fov,
      cameraState,
      (load3d: Load3d) => {
        const animationLoad3d = load3d as Load3dAnimation
        const names = animationLoad3d.getAnimationNames()

        const animationSelect = node.widgets.find(
          (w: IWidget) => w.name === 'animation'
        )

        animationSelect.options.values = names
        if (names.length) {
          animationSelect.value = names[0]
        }
      }
    )

    const w = node.widgets.find((w: IWidget) => w.name === 'width')
    const h = node.widgets.find((w: IWidget) => w.name === 'height')

    // @ts-expect-error hacky override
    sceneWidget.serializeValue = async () => {
      node.properties['Camera Info'] = JSON.stringify(load3d.getCameraState())

      load3d.toggleAnimation(false)

      const { scene: imageData, mask: maskData } = await load3d.captureScene(
        w.value,
        h.value
      )

      const [data, dataMask] = await Promise.all([
        uploadTempImage(imageData, 'scene'),
        uploadTempImage(maskData, 'scene_mask')
      ])

      return {
        image: `threed/${data.name} [temp]`,
        mask: `threed/${dataMask.name} [temp]`
      }
    }
  }
})

app.registerExtension({
  name: 'Comfy.Preview3D',

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (
      // @ts-expect-error ComfyNode
      ['Preview3D'].includes(nodeType.comfyClass)
    ) {
      nodeData.input.required.image = ['PREVIEW_3D']
    }
  },

  getCustomWidgets(app) {
    return {
      PREVIEW_3D(node, inputName) {
        let load3dNode = app.graph._nodes.filter((wi) => wi.type == 'Preview3D')

        const container = document.createElement('div')
        container.id = `comfy-preview-3d-${load3dNode.length}`
        container.classList.add('comfy-preview-3d')

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
          widget: node.addDOMWidget(inputName, 'PREVIEW_3D', container)
        }
      }
    }
  },

  init() {
    const style = document.createElement('style')

    style.innerText = `
        .comfy-preview-3d {
          ${load3dCSSCLASS}
        }
        
        .comfy-preview-3d canvas {
          ${load3dCanvasCSSCLASS}
        }
      `
    document.head.appendChild(style)
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Preview3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 550)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const bgColor = node.widgets.find((w: IWidget) => w.name === 'bg_color')

    const lightIntensity = node.widgets.find(
      (w: IWidget) => w.name === 'light_intensity'
    )

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

    const fov = node.widgets.find((w: IWidget) => w.name === 'fov')

    const onExecuted = node.onExecuted

    node.onExecuted = function (message: any) {
      onExecuted?.apply(this, arguments)

      let filePath = message.model_file[0]

      if (!filePath) {
        const msg = 'unable to get model file path.'

        console.error(msg)

        useToastStore().addAlert(msg)
      }

      modelWidget.value = filePath.replaceAll('\\', '/')

      configureLoad3D(
        load3d,
        'output',
        modelWidget,
        material,
        bgColor,
        lightIntensity,
        upDirection,
        fov
      )
    }
  }
})
