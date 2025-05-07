import type {
  IComboWidget,
  IStringWidget
} from '@comfyorg/litegraph/dist/types/widgets'
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

useExtensionService().registerExtension({
  name: 'Comfy.Load3D',
  settings: [
    {
      id: 'Comfy.Load3D.ShowGrid',
      category: ['3D', 'Scene', 'Initial Grid Visibility'],
      name: 'Initial Grid Visibility',
      tooltip:
        'Controls whether the grid is visible by default when a new 3D widget is created. This default can still be toggled individually for each widget after creation.',
      type: 'boolean',
      defaultValue: true,
      experimental: true
    },
    {
      id: 'Comfy.Load3D.ShowPreview',
      category: ['3D', 'Scene', 'Initial Preview Visibility'],
      name: 'Initial Preview Visibility',
      tooltip:
        'Controls whether the preview screen is visible by default when a new 3D widget is created. This default can still be toggled individually for each widget after creation.',
      type: 'boolean',
      defaultValue: true,
      experimental: true
    },
    {
      id: 'Comfy.Load3D.BackgroundColor',
      category: ['3D', 'Scene', 'Initial Background Color'],
      name: 'Initial Background Color',
      tooltip:
        'Controls the default background color of the 3D scene. This setting determines the background appearance when a new 3D widget is created, but can be adjusted individually for each widget after creation.',
      type: 'color',
      defaultValue: '282828',
      experimental: true
    },
    {
      id: 'Comfy.Load3D.CameraType',
      category: ['3D', 'Camera', 'Initial Camera Type'],
      name: 'Initial Camera Type',
      tooltip:
        'Controls whether the camera is perspective or orthographic by default when a new 3D widget is created. This default can still be toggled individually for each widget after creation.',
      type: 'combo',
      options: ['perspective', 'orthographic'],
      defaultValue: 'perspective',
      experimental: true
    },
    {
      id: 'Comfy.Load3D.LightIntensity',
      category: ['3D', 'Light', 'Initial Light Intensity'],
      name: 'Initial Light Intensity',
      tooltip:
        'Sets the default brightness level of lighting in the 3D scene. This value determines how intensely lights illuminate objects when a new 3D widget is created, but can be adjusted individually for each widget after creation.',
      type: 'number',
      defaultValue: 3,
      experimental: true
    },
    {
      id: 'Comfy.Load3D.LightIntensityMaximum',
      category: ['3D', 'Light', 'Light Intensity Maximum'],
      name: 'Light Intensity Maximum',
      tooltip:
        'Sets the maximum allowable light intensity value for 3D scenes. This defines the upper brightness limit that can be set when adjusting lighting in any 3D widget.',
      type: 'number',
      defaultValue: 10,
      experimental: true
    },
    {
      id: 'Comfy.Load3D.LightIntensityMinimum',
      category: ['3D', 'Light', 'Light Intensity Minimum'],
      name: 'Light Intensity Minimum',
      tooltip:
        'Sets the minimum allowable light intensity value for 3D scenes. This defines the lower brightness limit that can be set when adjusting lighting in any 3D widget.',
      type: 'number',
      defaultValue: 1,
      experimental: true
    },
    {
      id: 'Comfy.Load3D.LightAdjustmentIncrement',
      category: ['3D', 'Light', 'Light Adjustment Increment'],
      name: 'Light Adjustment Increment',
      tooltip:
        'Controls the increment size when adjusting light intensity in 3D scenes. A smaller step value allows for finer control over lighting adjustments, while a larger value results in more noticeable changes per adjustment.',
      type: 'slider',
      attrs: {
        min: 0.1,
        max: 1,
        step: 0.1
      },
      defaultValue: 0.5,
      experimental: true
    }
  ],
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
              (w) => w.name === 'model_file'
            ) as IComboWidget & { options: { values: string[] } }

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

          const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
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

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')
      const sceneWidget = node.widgets?.find((w) => w.name === 'image')

      if (modelWidget && width && height && sceneWidget) {
        config.configure('input', modelWidget, cameraState, width, height)

        sceneWidget.serializeValue = async () => {
          node.properties['Camera Info'] = load3d.getCameraState()

          load3d.stopRecording()

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

          const returnVal = {
            image: `threed/${data.name} [temp]`,
            mask: `threed/${dataMask.name} [temp]`,
            normal: `threed/${dataNormal.name} [temp]`,
            lineart: `threed/${dataLineart.name} [temp]`,
            camera_info: node.properties['Camera Info'],
            recording: ''
          }

          const recordingData = load3d.getRecordingData()

          if (recordingData) {
            const [recording] = await Promise.all([
              Load3dUtils.uploadTempImage(recordingData, 'recording', 'mp4')
            ])

            returnVal['recording'] = `threed/${recording.name} [temp]`
          }

          return returnVal
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
              (w) => w.name === 'model_file'
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

          const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
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

    const sceneWidget = node.widgets?.find((w) => w.name === 'image')

    const load3d = useLoad3dService().getLoad3d(node) as Load3dAnimation

    const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

    let cameraState = node.properties['Camera Info']

    const width = node.widgets?.find((w) => w.name === 'width')
    const height = node.widgets?.find((w) => w.name === 'height')

    if (modelWidget && width && height && sceneWidget && load3d) {
      const config = new Load3DConfiguration(load3d)

      config.configure('input', modelWidget, cameraState, width, height)

      sceneWidget.serializeValue = async () => {
        node.properties['Camera Info'] = load3d.getCameraState()

        load3d.toggleAnimation(false)

        if (load3d.isRecording()) {
          load3d.stopRecording()
        }

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

        const returnVal = {
          image: `threed/${data.name} [temp]`,
          mask: `threed/${dataMask.name} [temp]`,
          normal: `threed/${dataNormal.name} [temp]`,
          camera_info: node.properties['Camera Info'],
          recording: ''
        }

        const recordingData = load3d.getRecordingData()
        if (recordingData) {
          const [recording] = await Promise.all([
            Load3dUtils.uploadTempImage(recordingData, 'recording', 'mp4')
          ])
          returnVal['recording'] = `threed/${recording.name} [temp]`
        }

        return returnVal
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

      let filePath = message.result[0]

      if (!filePath) {
        const msg = t('toastMessages.unableToGetModelFilePath')
        console.error(msg)
        useToastStore().addAlert(msg)
      }

      const load3d = useLoad3dService().getLoad3d(node)

      let cameraState = message.result[1]

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

      if (load3d && modelWidget) {
        modelWidget.value = filePath.replaceAll('\\', '/')

        const config = new Load3DConfiguration(load3d)

        config.configure('output', modelWidget, cameraState)
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

      let filePath = message.result[0]

      if (!filePath) {
        const msg = t('toastMessages.unableToGetModelFilePath')
        console.error(msg)
        useToastStore().addAlert(msg)
      }

      let cameraState = message.result[1]

      const load3d = useLoad3dService().getLoad3d(node)

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      if (load3d && modelWidget) {
        modelWidget.value = filePath.replaceAll('\\', '/')

        const config = new Load3DConfiguration(load3d)

        config.configure('output', modelWidget, cameraState)
      }
    }
  }
})
