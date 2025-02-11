// @ts-strict-ignore
import { IWidget } from '@comfyorg/litegraph'
import type { IStringWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { nextTick } from 'vue'

import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { app } from '@/scripts/app'
import { useLoad3dService } from '@/services/load3dService'
import { useToastStore } from '@/stores/toastStore'

app.registerExtension({
  name: 'Comfy.Load3D',

  getCustomWidgets(app) {
    return {
      LOAD_3D(node, inputName) {
        node.addProperty('Camera Info', '')

        const container = document.createElement('div')
        container.classList.add('comfy-load-3d')

        const load3d = useLoad3dService().registerLoad3d(
          node,
          container,
          'Load3D'
        )

        node.onMouseEnter = function () {
          if (load3d) {
            load3d.refreshViewport()
          }
        }

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

          useLoad3dService().removeLoad3d(node)

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
            ) as IStringWidget
            const uploadPath = await Load3dUtils.uploadFile(
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

    const load3d = useLoad3dService().getLoad3d(node)

    load3d.setNode(node)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

    let cameraState = node.properties['Camera Info']

    const config = new Load3DConfiguration(load3d)

    const width = node.widgets.find((w: IWidget) => w.name === 'width')
    const height = node.widgets.find((w: IWidget) => w.name === 'height')

    config.configure(
      'input',
      modelWidget,
      material,
      upDirection,
      cameraState,
      width,
      height
    )

    sceneWidget.serializeValue = async () => {
      node.properties['Camera Info'] = load3d.getCameraState()

      const { scene: imageData, mask: maskData } = await load3d.captureScene(
        width.value as number,
        height.value as number
      )

      const [data, dataMask] = await Promise.all([
        Load3dUtils.uploadTempImage(imageData, 'scene'),
        Load3dUtils.uploadTempImage(maskData, 'scene_mask')
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
        node.addProperty('Camera Info', '')

        const container = document.createElement('div')

        container.classList.add('comfy-load-3d-animation')

        const load3d = useLoad3dService().registerLoad3d(
          node,
          container,
          'Load3DAnimation'
        )

        node.onMouseEnter = function () {
          if (load3d) {
            load3d.refreshViewport()
          }
        }

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

          useLoad3dService().removeLoad3d(node)

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
            ) as IStringWidget
            const uploadPath = await Load3dUtils.uploadFile(
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
          widget: node.addDOMWidget(inputName, 'LOAD_3D_ANIMATION', container)
        }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 700)])

    await nextTick()

    const sceneWidget = node.widgets.find((w: IWidget) => w.name === 'image')

    const load3d = useLoad3dService().getLoad3d(node) as Load3dAnimation

    load3d.setNode(node)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

    let cameraState = node.properties['Camera Info']

    const config = new Load3DConfiguration(load3d)

    const width = node.widgets.find((w: IWidget) => w.name === 'width')
    const height = node.widgets.find((w: IWidget) => w.name === 'height')

    config.configure(
      'input',
      modelWidget,
      material,
      upDirection,
      cameraState,
      width,
      height
    )

    sceneWidget.serializeValue = async () => {
      node.properties['Camera Info'] = load3d.getCameraState()

      load3d.toggleAnimation(false)

      const { scene: imageData, mask: maskData } = await load3d.captureScene(
        width.value as number,
        height.value as number
      )

      const [data, dataMask] = await Promise.all([
        Load3dUtils.uploadTempImage(imageData, 'scene'),
        Load3dUtils.uploadTempImage(maskData, 'scene_mask')
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
        const container = document.createElement('div')

        container.classList.add('comfy-preview-3d')

        const load3d = useLoad3dService().registerLoad3d(
          node,
          container,
          'Preview3D'
        )

        node.onMouseEnter = function () {
          if (load3d) {
            load3d.refreshViewport()
          }
        }

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

          useLoad3dService().removeLoad3d(node)

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

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    const load3d = useLoad3dService().getLoad3d(node)

    load3d.setNode(node)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

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

      const config = new Load3DConfiguration(load3d)

      config.configure('output', modelWidget, material, upDirection)
    }
  }
})

app.registerExtension({
  name: 'Comfy.Preview3DAnimation',

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (
      // @ts-expect-error ComfyNode
      ['Preview3DAnimation'].includes(nodeType.comfyClass)
    ) {
      nodeData.input.required.image = ['PREVIEW_3D_ANIMATION']
    }
  },

  getCustomWidgets(app) {
    return {
      PREVIEW_3D_ANIMATION(node, inputName) {
        const container = document.createElement('div')

        container.classList.add('comfy-preview-3d-animation')

        const load3d = useLoad3dService().registerLoad3d(
          node,
          container,
          'Preview3DAnimation'
        )

        node.onMouseEnter = function () {
          if (load3d) {
            load3d.refreshViewport()
          }
        }

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

          useLoad3dService().removeLoad3d(node)

          origOnRemoved?.apply(this, [])
        }

        node.onDrawBackground = function () {
          load3d.renderer.domElement.hidden = this.flags.collapsed ?? false
        }

        return {
          widget: node.addDOMWidget(
            inputName,
            'PREVIEW_3D_ANIMATION',
            container
          )
        }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Preview3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 550)])

    await nextTick()

    const load3d = useLoad3dService().getLoad3d(node)

    load3d.setNode(node)

    const modelWidget = node.widgets.find(
      (w: IWidget) => w.name === 'model_file'
    )

    const material = node.widgets.find((w: IWidget) => w.name === 'material')

    const upDirection = node.widgets.find(
      (w: IWidget) => w.name === 'up_direction'
    )

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

      const config = new Load3DConfiguration(load3d)

      config.configure('output', modelWidget, material, upDirection)
    }
  }
})
