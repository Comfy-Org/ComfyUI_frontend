import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useToastStore } from '@/stores/toastStore'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { IWidget } from '@comfyorg/litegraph'
import { ComfyNode } from '@/types/comfyWorkflow'
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
    body.append('subfolder', 'mesh')

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
            mtlFormData.append('subfolder', 'mesh')

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
  currentModel: THREE.Object3D | null = null
  node: any
  private animationFrameId: number | null = null
  gridHelper: THREE.GridHelper
  lights: THREE.Light[] = []

  constructor(node: ComfyNode, container: Element | HTMLElement) {
    this.node = node

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

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    this.scene.add(directionalLight)
    this.lights.push(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)
    this.lights.push(ambientLight)

    this.gridHelper = new THREE.GridHelper(10, 10)
    this.gridHelper.position.set(0, 0, 0)
    this.scene.add(this.gridHelper)

    this.animate()

    this.handleResize()

    this.startAnimation()
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

  toggleGrid(showGrid) {
    if (this.gridHelper) {
      this.gridHelper.visible = showGrid
    }
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
        case 'obj':
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

          model = await this.objLoader.loadAsync(url)
          break

        case 'gltf':
        case 'glb':
          const gltf = await this.gltfLoader.loadAsync(url)
          model = gltf.scene
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

app.registerExtension({
  name: 'Comfy.Load3D',

  getCustomWidgets(app) {
    return {
      LOAD_3D(node, inputName) {
        let load3dNodes = app.graph._nodes.filter((wi) => wi.type == 'Load3D')

        node.name = `load3d_${load3dNodes.length}`

        const containerWrapper = document.createElement('div')

        containerWrapper.id = `load-3d-wrapper-${inputName.toLowerCase()}`
        containerWrapper.classList.add('comfyui-load-3d-wrapper')

        const container = document.createElement('div')
        container.id = `load-3d-${inputName.toLowerCase()}`
        container.classList.add('comfyui-load-3d')
        containerWrapper.appendChild(container)

        const buttonContainer = document.createElement('div')
        buttonContainer.classList.add('comfyui-load-3d-buttons')
        containerWrapper.appendChild(buttonContainer)

        node.load3d = new Load3d(node, container)

        const modelWidget = node.widgets.find(
          (w: IWidget) => w.name === 'model_file'
        )

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.gltf,.glb,.obj,.mtl'
        fileInput.style.display = 'none'
        fileInput.onchange = () => {
          if (fileInput.files?.length) {
            uploadFile(
              modelWidget,
              node.load3d,
              fileInput.files[0],
              true,
              fileInput
            ).catch((error) => {
              console.error('File upload failed:', error)
              useToastStore().addAlert('File upload failed')
            })
          }
        }

        const buttonGroup = document.createElement('div')
        buttonGroup.classList.add('comfyui-load-3d-button-group')
        buttonContainer.appendChild(buttonGroup)

        const uploadButton: HTMLButtonElement = document.createElement('button')
        uploadButton.textContent = 'Choose Model'
        uploadButton.onclick = () => fileInput.click()
        uploadButton.className = 'comfyui-load-3d-btn full-width'
        buttonGroup.appendChild(uploadButton)

        const clearModelButton: HTMLButtonElement =
          document.createElement('button')
        clearModelButton.textContent = 'Clear Model'
        clearModelButton.className = 'comfyui-load-3d-btn full-width'
        clearModelButton.onclick = () => {
          node.load3d.clearModel()
          const modelWidget = node.widgets.find(
            (w: IWidget) => w.name === 'model_file'
          )
          if (modelWidget) {
            modelWidget.value = ''
          }
        }
        buttonGroup.appendChild(clearModelButton)

        node.onResize = function () {
          let [w, h] = this.size
          if (w <= 300) w = 300
          if (h <= 300) h = 300
          this.size = [w, h]

          if (this.load3d) {
            this.load3d.handleResize()
          }
        }

        const origOnRemoved = node.onRemoved

        node.onRemoved = function () {
          if (this.load3d) {
            this.load3d.remove()
          }

          fileInput.remove()

          origOnRemoved?.apply(this, arguments)
        }

        node.onDrawBackground = function () {
          node.load3d.renderer.domElement.hidden = this.flags.collapsed
        }

        return {
          widget: node.addDOMWidget(inputName, 'LOAD_3D', containerWrapper)
        }
      }
    }
  },

  init() {
    const style = document.createElement('style')

    style.innerText = `
        .comfyui-load-3d-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px;
          background: transparent;
        }
        
        .comfyui-load-3d {
          flex: 1;
          position: relative;
          overflow: hidden;
          border-radius: 4px;
          background: #1a1a1a;
        }
        
        .comfyui-load-3d canvas {
          width: 100% !important;
          height: 100% !important;
        }
        
        .comfyui-load-3d-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .comfyui-load-3d-button-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .comfyui-load-3d-btn {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #fff;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }
        
        .full-width {
          width: 100%;
        }
        
        .comfyui-load-3d-btn:hover {
          background: #3a3a3a;
        }
      `
    document.head.appendChild(style)
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    node.setSize([300, 550])

    await nextTick()

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const onModelWidgetUpdate = () => {
      if (modelWidget.value) {
        const filename = modelWidget.value
        const modelUrl = api.apiURL(getResourceURL(...splitFilePath(filename)))

        node.load3d.loadModel(modelUrl, filename)
      }
    }

    if (modelWidget.value) {
      onModelWidgetUpdate()
    }

    modelWidget.callback = onModelWidgetUpdate

    const showGrid = node.widgets.find((w: IWidget) => w.name === 'show_grid')

    node.load3d.toggleGrid(showGrid.value)

    showGrid.callback = (value) => {
      node.load3d.toggleGrid(value)
    }

    const cameraType = node.widgets.find(
      (w: IWidget) => w.name === 'camera_type'
    )

    node.load3d.toggleCamera(cameraType.value)

    cameraType.callback = (value) => {
      node.load3d.toggleCamera(value)
    }

    const view = node.widgets.find((w: IWidget) => w.name === 'view')

    view.callback = (value) => {
      node.load3d.setViewPosition(value)
    }

    const bgColor = node.widgets.find((w: IWidget) => w.name === 'bg_color')

    /*
    const backgrounds = [
      { name: 'Dark', color: '#282828' },
      { name: 'Light', color: '#f0f0f0' },
      { name: 'Black', color: '#000000' },
      { name: 'White', color: '#ffffff' }
    ]
     */

    node.load3d.setBackgroundColor(bgColor.value)

    bgColor.callback = (value) => {
      node.load3d.setBackgroundColor(value)
    }

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')
    const w = node.widgets.find((w: IWidget) => w.name === 'width')
    const h = node.widgets.find((w: IWidget) => w.name === 'height')

    sceneWidget.serializeValue = async () => {
      const imageData = await node.load3d.captureScene(w.value, h.value)

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
  }
})
