// @ts-strict-ignore
import { IWidget } from '@comfyorg/litegraph'
import { nextTick } from 'vue'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
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

  const cameraType = load3d.loadNodeProperty('Camera Type', 'perspective')

  load3d.toggleCamera(cameraType)

  const showGrid = load3d.loadNodeProperty('Show Grid', true)

  load3d.toggleGrid(showGrid)
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

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 600)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    load3d.setNode(node)

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

    let cameraState = node.properties['Camera Info']

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
      node.properties['Camera Info'] = load3d.getCameraState()

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

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 700)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    load3d.setNode(node)

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

    let cameraState = node.properties['Camera Info']

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
      node.properties['Camera Info'] = load3d.getCameraState()

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

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Preview3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 550)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const container = sceneWidget.element

    const load3d = containerToLoad3D.get(container.id)

    load3d.setNode(node)

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
