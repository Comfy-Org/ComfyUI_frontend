import { IWidget } from '@comfyorg/litegraph'
import { IStringWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { nextTick } from 'vue'

import Load3D from '@/components/load3d/Load3D.vue'
import Load3DAnimation from '@/components/load3d/Load3DAnimation.vue'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { t } from '@/i18n'
import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'
import { useToastStore } from '@/stores/toastStore'
import { generateUUID } from '@/utils/formatUtil'

useExtensionService().registerExtension({
  name: 'Comfy.Load3D',

  getCustomWidgets() {
    return {
      LOAD_3D(node) {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.gltf,.glb,.obj,.mtl,.fbx,.stl'
        fileInput.style.display = 'none'

        fileInput.onchange = async () => {
          if (fileInput.files?.length) {
            const modelWidget = node.widgets?.find(
              (w: IWidget) => w.name === 'model_file'
            ) as IStringWidget

            node.properties['Texture'] = undefined

            const uploadPath = await Load3dUtils.uploadFile(
              fileInput.files[0]
            ).catch((error) => {
              console.error('File upload failed:', error)
              useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
            })

            const modelUrl = api.apiURL(
              Load3dUtils.getResourceURL(
                ...Load3dUtils.splitFilePath(uploadPath),
                'input'
              )
            )

            await useLoad3dService().getLoad3d(node)?.loadModel(modelUrl)

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
          useLoad3dService().getLoad3d(node)?.clearModel()

          const modelWidget = node.widgets?.find(
            (w: IWidget) => w.name === 'model_file'
          )
          if (modelWidget) {
            modelWidget.value = ''

            node.properties['Texture'] = undefined
          }
        })

        const inputSpec: CustomInputSpec = {
          name: 'image',
          type: 'Load3D',
          isAnimation: false,
          isPreview: false
        }

        const widget = new ComponentWidgetImpl({
          id: generateUUID(),
          node,
          name: inputSpec.name,
          component: Load3D,
          inputSpec,
          options: {}
        })

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 600)])

    await nextTick()

    const load3d = useLoad3dService().getLoad3d(node)

    if (load3d) {
      let cameraState = node.properties['Camera Info']

      const config = new Load3DConfiguration(load3d)

      const modelWidget = node.widgets?.find(
        (w: IWidget) => w.name === 'model_file'
      )
      const width = node.widgets?.find((w: IWidget) => w.name === 'width')
      const height = node.widgets?.find((w: IWidget) => w.name === 'height')
      const sceneWidget = node.widgets?.find((w: IWidget) => w.name === 'image')

      if (modelWidget && width && height && sceneWidget) {
        config.configure('input', modelWidget, cameraState, width, height)

        sceneWidget.serializeValue = async () => {
          node.properties['Camera Info'] = load3d.getCameraState()

          const {
            scene: imageData,
            mask: maskData,
            normal: normalData,
            lineart: lineartData
          } = await load3d.captureScene(
            width.value as number,
            height.value as number
          )

          const [data, dataMask, dataNormal, dataLineart] = await Promise.all([
            Load3dUtils.uploadTempImage(imageData, 'scene'),
            Load3dUtils.uploadTempImage(maskData, 'scene_mask'),
            Load3dUtils.uploadTempImage(normalData, 'scene_normal'),
            Load3dUtils.uploadTempImage(lineartData, 'scene_lineart')
          ])

          load3d.handleResize()

          return {
            image: `threed/${data.name} [temp]`,
            mask: `threed/${dataMask.name} [temp]`,
            normal: `threed/${dataNormal.name} [temp]`,
            lineart: `threed/${dataLineart.name} [temp]`
          }
        }
      }
    }
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.Load3DAnimation',

  getCustomWidgets() {
    return {
      LOAD_3D_ANIMATION(node) {
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
              fileInput.files[0]
            ).catch((error) => {
              console.error('File upload failed:', error)
              useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
            })

            const modelUrl = api.apiURL(
              Load3dUtils.getResourceURL(
                ...Load3dUtils.splitFilePath(uploadPath),
                'input'
              )
            )

            await useLoad3dService().getLoad3d(node)?.loadModel(modelUrl)

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
          useLoad3dService().getLoad3d(node)?.clearModel()

          const modelWidget = node.widgets?.find(
            (w: IWidget) => w.name === 'model_file'
          )
          if (modelWidget) {
            modelWidget.value = ''
          }
        })

        const inputSpec: CustomInputSpec = {
          name: 'image',
          type: 'Load3DAnimation',
          isAnimation: true,
          isPreview: false
        }

        const widget = new ComponentWidgetImpl({
          id: generateUUID(),
          node,
          name: inputSpec.name,
          component: Load3DAnimation,
          inputSpec,
          options: {}
        })

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Load3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 700)])

    await nextTick()

    const sceneWidget = node.widgets?.find((w: IWidget) => w.name === 'image')

    const load3d = useLoad3dService().getLoad3d(node) as Load3dAnimation

    const modelWidget = node.widgets?.find(
      (w: IWidget) => w.name === 'model_file'
    )

    let cameraState = node.properties['Camera Info']

    const width = node.widgets?.find((w: IWidget) => w.name === 'width')
    const height = node.widgets?.find((w: IWidget) => w.name === 'height')

    if (modelWidget && width && height && sceneWidget) {
      const config = new Load3DConfiguration(load3d)

      config.configure('input', modelWidget, cameraState, width, height)

      sceneWidget.serializeValue = async () => {
        node.properties['Camera Info'] = load3d.getCameraState()

        load3d.toggleAnimation(false)

        const {
          scene: imageData,
          mask: maskData,
          normal: normalData
        } = await load3d.captureScene(
          width.value as number,
          height.value as number
        )

        const [data, dataMask, dataNormal] = await Promise.all([
          Load3dUtils.uploadTempImage(imageData, 'scene'),
          Load3dUtils.uploadTempImage(maskData, 'scene_mask'),
          Load3dUtils.uploadTempImage(normalData, 'scene_normal')
        ])

        load3d.handleResize()

        return {
          image: `threed/${data.name} [temp]`,
          mask: `threed/${dataMask.name} [temp]`,
          normal: `threed/${dataNormal.name} [temp]`
        }
      }
    }
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.Preview3D',

  async beforeRegisterNodeDef(_nodeType, nodeData) {
    if ('Preview3D' === nodeData.name) {
      // @ts-expect-error InputSpec is not typed correctly
      nodeData.input.required.image = ['PREVIEW_3D']
    }
  },

  getCustomWidgets() {
    return {
      PREVIEW_3D(node) {
        const inputSpec: CustomInputSpec = {
          name: 'image',
          type: 'Preview3D',
          isAnimation: false,
          isPreview: true
        }

        const widget = new ComponentWidgetImpl({
          id: generateUUID(),
          node,
          name: inputSpec.name,
          component: Load3D,
          inputSpec,
          options: {}
        })

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Preview3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    const onExecuted = node.onExecuted

    node.onExecuted = function (message: any) {
      onExecuted?.apply(this, arguments as any)

      let filePath = message.model_file[0]

      if (!filePath) {
        const msg = t('toastMessages.unableToGetModelFilePath')
        console.error(msg)
        useToastStore().addAlert(msg)
      }

      const load3d = useLoad3dService().getLoad3d(node)

      const modelWidget = node.widgets?.find(
        (w: IWidget) => w.name === 'model_file'
      )

      if (load3d && modelWidget) {
        modelWidget.value = filePath.replaceAll('\\', '/')

        const config = new Load3DConfiguration(load3d)

        config.configure('output', modelWidget)
      }
    }
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.Preview3DAnimation',

  async beforeRegisterNodeDef(_nodeType, nodeData) {
    if ('Preview3DAnimation' === nodeData.name) {
      // @ts-expect-error InputSpec is not typed correctly
      nodeData.input.required.image = ['PREVIEW_3D_ANIMATION']
    }
  },

  getCustomWidgets() {
    return {
      PREVIEW_3D_ANIMATION(node) {
        const inputSpec: CustomInputSpec = {
          name: 'image',
          type: 'Preview3DAnimation',
          isAnimation: true,
          isPreview: true
        }

        const widget = new ComponentWidgetImpl({
          id: generateUUID(),
          node,
          name: inputSpec.name,
          component: Load3DAnimation,
          inputSpec,
          options: {}
        })

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Preview3DAnimation') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 550)])

    await nextTick()

    const onExecuted = node.onExecuted

    node.onExecuted = function (message: any) {
      onExecuted?.apply(this, arguments as any)

      let filePath = message.model_file[0]

      if (!filePath) {
        const msg = t('toastMessages.unableToGetModelFilePath')
        console.error(msg)
        useToastStore().addAlert(msg)
      }

      const load3d = useLoad3dService().getLoad3d(node)

      const modelWidget = node.widgets?.find(
        (w: IWidget) => w.name === 'model_file'
      )
      if (load3d && modelWidget) {
        modelWidget.value = filePath.replaceAll('\\', '/')

        const config = new Load3DConfiguration(load3d)

        config.configure('output', modelWidget)
      }
    }
  }
})
