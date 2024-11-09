// @ts-strict-ignore
import { app } from '../../scripts/app'
import { api } from '../../scripts/api'
import { useToastStore } from '@/stores/toastStore'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'

async function uploadFile(
  modelWidget: IWidget,
  load3d: Load3d,
  file: File,
  updateNode: boolean,
  fileInput?: HTMLInputElement,
  pasted: boolean = false
) {
  try {
    const body = new FormData()
    body.append('image', file)
    if (pasted) body.append('subfolder', 'pasted')

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status === 200) {
      const data = await resp.json()
      let path = data.name
      if (data.subfolder) path = data.subfolder + '/' + path

      if (!modelWidget.options.values.includes(path)) {
        modelWidget.options.values.push(path)
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
            if (pasted) mtlFormData.append('subfolder', 'pasted')

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

  constructor(node, container) {
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
    container.appendChild(this.renderer.domElement)

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

  toggleCamera() {
    const position = this.activeCamera.position.clone()
    const rotation = this.activeCamera.rotation.clone()
    const target = this.controls.target.clone()

    this.activeCamera =
      this.activeCamera === this.perspectiveCamera
        ? this.orthographicCamera
        : this.perspectiveCamera

    this.activeCamera.position.copy(position)
    this.activeCamera.rotation.copy(rotation)

    this.controls.object = this.activeCamera
    this.controls.target.copy(target)
    this.controls.update()

    this.handleResize()
  }

  toggleGrid() {
    if (this.gridHelper) {
      this.gridHelper.visible = !this.gridHelper.visible
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
        throw new Error('Could not determine file type')
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
          throw new Error(`Unsupported file format: ${fileExtension}`)
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
    const width = this.renderer.domElement.parentElement.clientWidth
    const height = this.renderer.domElement.parentElement.clientHeight

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

  setViewPosition(position: 'front' | 'top' | 'right' | 'iso') {
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
      case 'iso':
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

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === 'Load3D') {
      console.log('[Load 3D] Registering node...', nodeData)
    }
  },

  getCustomWidgets(app) {
    return {
      LOAD_3D(node, inputName) {
        const container1 = document.createElement('div')

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

        const widget = {
          type: 'load3d',
          name: `l3d_${inputName}`,
          draw: function (ctx, _, widgetWidth, y, widgetHeight) {
            const margin = 10
            const visible = app.canvas.ds.scale > 0.5
            const w = widgetWidth - margin * 2

            const clientRectBound = ctx.canvas.getBoundingClientRect()
            const transform = new DOMMatrix()
              .scaleSelf(
                clientRectBound.width / ctx.canvas.width,
                clientRectBound.height / ctx.canvas.height
              )
              .multiplySelf(ctx.getTransform())
              .translateSelf(margin, margin + y)

            Object.assign(this.container.style, {
              left: `${transform.a * margin + transform.e}px`,
              top: `${transform.d + transform.f}px`,
              width: `${w * transform.a}px`,
              height: `${w * transform.d}px`,
              position: 'absolute',
              zIndex: app.graph._nodes.indexOf(node)
            })

            this.container.hidden = !visible

            if (node.load3d && !this.container.hidden) {
              node.load3d.handleResize()
            }
          }
        }

        node.load3d = new Load3d(node, container)

        widget.container = containerWrapper
        widget.parent = node

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

        const uploadButton = document.createElement('button')
        uploadButton.textContent = 'Choose Model'
        uploadButton.onclick = () => fileInput.click()
        uploadButton.className = 'comfyui-load-3d-btn full-width'
        buttonGroup.appendChild(uploadButton)

        const clearModelButton = document.createElement('button')
        clearModelButton.textContent = 'Clear Model'
        clearModelButton.className = 'comfyui-load-3d-btn full-width'
        clearModelButton.onclick = () => {
          node.load3d.clearModel()
          const modelWidget = node.widgets.find((w) => w.name === 'model_file')
          if (modelWidget) {
            modelWidget.value = ''
          }
        }
        buttonGroup.appendChild(clearModelButton)

        const controlsWrapper = document.createElement('div')
        controlsWrapper.classList.add('comfyui-load-3d-controls-wrapper')
        buttonContainer.appendChild(controlsWrapper)

        const controlsHeader = document.createElement('div')
        controlsHeader.classList.add('comfyui-load-3d-controls-header')
        controlsWrapper.appendChild(controlsHeader)

        const headerTitle = document.createElement('span')
        headerTitle.textContent = 'Display Controls'
        headerTitle.className = 'controls-header-title'

        const collapseIcon = document.createElement('span')
        collapseIcon.className = 'collapse-icon'
        collapseIcon.textContent = '▼'

        controlsHeader.appendChild(headerTitle)
        controlsHeader.appendChild(collapseIcon)

        const controlsContainer = document.createElement('div')
        controlsContainer.classList.add('comfyui-load-3d-controls')
        controlsWrapper.appendChild(controlsContainer)

        let isExpanded = true
        controlsHeader.onclick = () => {
          isExpanded = !isExpanded
          controlsContainer.classList.toggle('collapsed', !isExpanded)
          collapseIcon.textContent = isExpanded ? '▼' : '▶'
          collapseIcon.style.transform = isExpanded ? 'none' : 'rotate(-90deg)'

          const transitionDuration = 200
          setTimeout(() => {
            if (node.load3d) {
              node.load3d.handleResize()
            }
          }, transitionDuration)
        }

        const viewContainer = document.createElement('div')
        viewContainer.classList.add('comfyui-load-3d-control-group')

        const viewLabel = document.createElement('span')
        viewLabel.textContent = 'View:'
        viewLabel.className = 'control-label'

        const viewSelect = document.createElement('select')
        viewSelect.className = 'comfyui-load-3d-select'

        const views = [
          { name: 'Front View', value: 'front' },
          { name: 'Top View', value: 'top' },
          { name: 'Right View', value: 'right' },
          { name: 'Isometric', value: 'iso' }
        ]

        views.forEach((view) => {
          const option = document.createElement('option')
          option.value = view.value
          option.textContent = view.name
          viewSelect.appendChild(option)
        })

        viewSelect.onchange = () => {
          node.load3d.setViewPosition(viewSelect.value as any)
        }

        viewContainer.appendChild(viewLabel)
        viewContainer.appendChild(viewSelect)
        controlsContainer.appendChild(viewContainer)

        const cameraContainer = document.createElement('div')
        cameraContainer.classList.add('comfyui-load-3d-control-group')

        const cameraLabel = document.createElement('span')
        cameraLabel.textContent = 'Camera:'
        cameraLabel.className = 'control-label'

        const cameraSelect = document.createElement('select')
        cameraSelect.className = 'comfyui-load-3d-select'

        const cameras = [
          { name: 'Perspective', value: 'perspective' },
          { name: 'Orthographic', value: 'orthographic' }
        ]

        cameras.forEach((camera) => {
          const option = document.createElement('option')
          option.value = camera.value
          option.textContent = camera.name
          cameraSelect.appendChild(option)
        })

        cameraSelect.onchange = () => {
          node.load3d.toggleCamera()
        }

        cameraContainer.appendChild(cameraLabel)
        cameraContainer.appendChild(cameraSelect)
        controlsContainer.appendChild(cameraContainer)

        const gridContainer = document.createElement('div')
        gridContainer.classList.add('comfyui-load-3d-control-group')

        const gridLabel = document.createElement('span')
        gridLabel.textContent = 'Grid:'
        gridLabel.className = 'control-label'

        const gridSelect = document.createElement('select')
        gridSelect.className = 'comfyui-load-3d-select'

        const grids = [
          { name: 'Show', value: 'show' },
          { name: 'Hide', value: 'hide' }
        ]

        grids.forEach((grid) => {
          const option = document.createElement('option')
          option.value = grid.value
          option.textContent = grid.name
          gridSelect.appendChild(option)
        })

        gridSelect.onchange = () => {
          node.load3d.toggleGrid()
        }

        gridContainer.appendChild(gridLabel)
        gridContainer.appendChild(gridSelect)
        controlsContainer.appendChild(gridContainer)

        const bgContainer = document.createElement('div')
        bgContainer.classList.add('comfyui-load-3d-control-group')

        const bgLabel = document.createElement('span')
        bgLabel.textContent = 'Background:'
        bgLabel.className = 'control-label'

        const bgSelect = document.createElement('select')
        bgSelect.className = 'comfyui-load-3d-select'

        const backgrounds = [
          { name: 'Dark', color: '#282828' },
          { name: 'Light', color: '#f0f0f0' },
          { name: 'Black', color: '#000000' },
          { name: 'White', color: '#ffffff' }
        ]

        backgrounds.forEach((bg) => {
          const option = document.createElement('option')
          option.value = bg.color
          option.textContent = bg.name
          bgSelect.appendChild(option)
        })

        bgSelect.onchange = () => {
          node.load3d.setBackgroundColor(bgSelect.value)
        }

        bgContainer.appendChild(bgLabel)
        bgContainer.appendChild(bgSelect)
        controlsContainer.appendChild(bgContainer)

        const onModelWidgetUpdate = () => {
          if (modelWidget.value) {
            const filename = modelWidget.value
            const modelUrl = api.apiURL(
              getResourceURL(...splitFilePath(filename))
            )

            node.load3d.loadModel(modelUrl, filename)
          }
        }

        if (modelWidget.value) {
          onModelWidgetUpdate()
        }

        modelWidget.callback = onModelWidgetUpdate

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

          widget.container?.remove()

          origOnRemoved?.apply(this, arguments)
        }

        node.onDrawBackground = function (ctx) {
          node.load3d.renderer.domElement.hidden = this.flags.collapsed
        }

        return {
          widget: node.addDOMWidget(inputName, 'LOAD_3D', widget.container)
        }
      }
    }
  },

  async init(app) {
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
      
        .comfyui-load-3d-controls-wrapper {
          border-radius: 4px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.2);
        }
        
        .comfyui-load-3d-controls-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          cursor: pointer;
          user-select: none;
          transition: background-color 0.2s;
        }
      
        .comfyui-load-3d-controls-header:hover {
          background: rgba(0, 0, 0, 0.4);
        }
      
        .controls-header-title {
          color: #fff;
          font-size: 12px;
          font-weight: 500;
        }
      
        .collapse-icon {
          color: #fff;
          font-size: 10px;
          transition: transform 0.2s ease;
        }
        
        .comfyui-load-3d-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .comfyui-load-3d-control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .control-label {
          color: #fff;
          font-size: 12px;
          min-width: 70px;
        }
        
        .comfyui-load-3d-select {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          flex: 1;
        }
        
        .comfyui-load-3d-select:hover {
          background: #3a3a3a;
        }
        
        .comfyui-load-3d-select:focus {
          outline: none;
          border-color: #4a4a4a;
        }
        .comfyui-load-3d-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s ease;
          max-height: 500px; /* 或者其他合适的值 */
          overflow: hidden;
        }
      
        .comfyui-load-3d-controls.collapsed {
          max-height: 0;
          padding: 0;
          opacity: 0;
        }
      `
    document.head.appendChild(style)
  },

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const sceneWidget = node.widgets.find((w) => w.name === 'image')
    const w = node.widgets.find((w) => w.name === 'width')
    const h = node.widgets.find((w) => w.name === 'height')

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
