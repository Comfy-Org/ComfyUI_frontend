import { nextTick } from 'vue'

import Load3D from '@/components/load3d/Load3D.vue'
import Load3DAnimation from '@/components/load3d/Load3DAnimation.vue'
import Load3DViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { t } from '@/i18n'
import type { IStringWidget } from '@/lib/litegraph/src/types/widgets'
import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { ComfyApp, app } from '@/scripts/app'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'
import { useToastStore } from '@/stores/toastStore'
import { isLoad3dNode } from '@/utils/litegraphUtil'

async function handleModelUpload(files: FileList, node: any) {
  if (!files?.length) return

  const modelWidget = node.widgets?.find(
    (w: any) => w.name === 'model_file'
  ) as IStringWidget

  try {
    const resourceFolder = (node.properties['Resource Folder'] as string) || ''

    const subfolder = resourceFolder.trim()
      ? `3d/${resourceFolder.trim()}`
      : '3d'

    const uploadPath = await Load3dUtils.uploadFile(files[0], subfolder)

    if (!uploadPath) {
      useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
      return
    }

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
  } catch (error) {
    console.error('Model upload failed:', error)
    useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
  }
}

async function handleResourcesUpload(files: FileList, node: any) {
  if (!files?.length) return

  try {
    const resourceFolder = (node.properties['Resource Folder'] as string) || ''

    const subfolder = resourceFolder.trim()
      ? `3d/${resourceFolder.trim()}`
      : '3d'

    await Load3dUtils.uploadMultipleFiles(files, subfolder)
  } catch (error) {
    console.error('Extra resources upload failed:', error)
    useToastStore().addAlert(t('toastMessages.extraResourcesUploadFailed'))
  }
}

function createFileInput(
  accept: string,
  multiple: boolean = false
): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.style.display = 'none'
  return input
}

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
    },
    {
      id: 'Comfy.Load3D.3DViewerEnable',
      category: ['3D', '3DViewer', 'Enable'],
      name: 'Enable 3D Viewer (Beta)',
      tooltip:
        'Enables the 3D Viewer (Beta) for selected nodes. This feature allows you to visualize and interact with 3D models directly within the full size 3d viewer.',
      type: 'boolean',
      defaultValue: false,
      experimental: true
    }
  ],
  commands: [
    {
      id: 'Comfy.3DViewer.Open3DViewer',
      icon: 'pi pi-pencil',
      label: 'Open 3D Viewer (Beta) for Selected Node',
      function: () => {
        const selectedNodes = app.canvas.selected_nodes
        if (!selectedNodes || Object.keys(selectedNodes).length !== 1) return

        const selectedNode = selectedNodes[Object.keys(selectedNodes)[0]]

        if (!isLoad3dNode(selectedNode)) return

        ComfyApp.copyToClipspace(selectedNode)
        // @ts-expect-error clipspace_return_node is an extension property added at runtime
        ComfyApp.clipspace_return_node = selectedNode

        const props = { node: selectedNode }

        useDialogStore().showDialog({
          key: 'global-load3d-viewer',
          title: t('load3d.viewer.title'),
          component: Load3DViewerContent,
          props: props,
          dialogComponentProps: {
            style: 'width: 80vw; height: 80vh;',
            maximizable: true,
            onClose: async () => {
              await useLoad3dService().handleViewerClose(props.node)
            }
          }
        })
      }
    }
  ],
  getCustomWidgets() {
    return {
      LOAD_3D(node) {
        const fileInput = createFileInput('.gltf,.glb,.obj,.fbx,.stl', false)

        node.properties['Resource Folder'] = ''

        fileInput.onchange = async () => {
          await handleModelUpload(fileInput.files!, node)
        }

        node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
          fileInput.click()
        })

        const resourcesInput = createFileInput('*', true)

        resourcesInput.onchange = async () => {
          await handleResourcesUpload(resourcesInput.files!, node)
          resourcesInput.value = ''
        }

        node.addWidget(
          'button',
          'upload extra resources',
          'uploadExtraResources',
          () => {
            resourcesInput.click()
          }
        )

        node.addWidget('button', 'clear', 'clear', () => {
          useLoad3dService().getLoad3d(node)?.clearModel()

          const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
          if (modelWidget) {
            modelWidget.value = ''
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

    useLoad3dService().waitForLoad3d(node, (load3d) => {
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
    })
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.Load3DAnimation',

  getCustomWidgets() {
    return {
      LOAD_3D_ANIMATION(node) {
        const fileInput = createFileInput('.gltf,.glb,.fbx', false)

        node.properties['Resource Folder'] = ''

        fileInput.onchange = async () => {
          await handleModelUpload(fileInput.files!, node)
        }

        node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
          fileInput.click()
        })

        const resourcesInput = createFileInput('*', true)

        resourcesInput.onchange = async () => {
          await handleResourcesUpload(resourcesInput.files!, node)
          resourcesInput.value = ''
        }

        node.addWidget(
          'button',
          'upload extra resources',
          'uploadExtraResources',
          () => {
            resourcesInput.click()
          }
        )

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

    useLoad3dService().waitForLoad3d(node, (load3d) => {
      const sceneWidget = node.widgets?.find((w) => w.name === 'image')
      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      let cameraState = node.properties['Camera Info']
      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')

      if (modelWidget && width && height && sceneWidget && load3d) {
        const config = new Load3DConfiguration(load3d)

        config.configure('input', modelWidget, cameraState, width, height)

        sceneWidget.serializeValue = async () => {
          node.properties['Camera Info'] = load3d.getCameraState()

          const load3dAnimation = load3d as Load3dAnimation
          load3dAnimation.toggleAnimation(false)

          if (load3dAnimation.isRecording()) {
            load3dAnimation.stopRecording()
          }

          const {
            scene: imageData,
            mask: maskData,
            normal: normalData
          } = await load3dAnimation.captureScene(
            width.value as number,
            height.value as number
          )

          const [data, dataMask, dataNormal] = await Promise.all([
            Load3dUtils.uploadTempImage(imageData, 'scene'),
            Load3dUtils.uploadTempImage(maskData, 'scene_mask'),
            Load3dUtils.uploadTempImage(normalData, 'scene_normal')
          ])

          load3dAnimation.handleResize()

          const returnVal = {
            image: `threed/${data.name} [temp]`,
            mask: `threed/${dataMask.name} [temp]`,
            normal: `threed/${dataNormal.name} [temp]`,
            camera_info: node.properties['Camera Info'],
            recording: ''
          }

          const recordingData = load3dAnimation.getRecordingData()
          if (recordingData) {
            const [recording] = await Promise.all([
              Load3dUtils.uploadTempImage(recordingData, 'recording', 'mp4')
            ])
            returnVal['recording'] = `threed/${recording.name} [temp]`
          }

          return returnVal
        }
      }
    })
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

    useLoad3dService().waitForLoad3d(node, (load3d) => {
      const config = new Load3DConfiguration(load3d)

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

      if (modelWidget) {
        const lastTimeModelFile = node.properties['Last Time Model File']

        if (lastTimeModelFile) {
          modelWidget.value = lastTimeModelFile

          const cameraState = node.properties['Camera Info']

          config.configure('output', modelWidget, cameraState)
        }

        node.onExecuted = function (message: any) {
          onExecuted?.apply(this, arguments as any)

          let filePath = message.result[0]

          if (!filePath) {
            const msg = t('toastMessages.unableToGetModelFilePath')
            console.error(msg)
            useToastStore().addAlert(msg)
          }

          let cameraState = message.result[1]

          modelWidget.value = filePath.replaceAll('\\', '/')

          node.properties['Last Time Model File'] = modelWidget.value

          config.configure('output', modelWidget, cameraState)
        }
      }
    })
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

    useLoad3dService().waitForLoad3d(node, (load3d) => {
      const config = new Load3DConfiguration(load3d)

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

      if (modelWidget) {
        const lastTimeModelFile = node.properties['Last Time Model File']

        if (lastTimeModelFile) {
          modelWidget.value = lastTimeModelFile

          const cameraState = node.properties['Camera Info']

          config.configure('output', modelWidget, cameraState)
        }

        node.onExecuted = function (message: any) {
          onExecuted?.apply(this, arguments as any)

          let filePath = message.result[0]

          if (!filePath) {
            const msg = t('toastMessages.unableToGetModelFilePath')
            console.error(msg)
            useToastStore().addAlert(msg)
          }

          let cameraState = message.result[1]

          modelWidget.value = filePath.replaceAll('\\', '/')

          node.properties['Last Time Model File'] = modelWidget.value

          config.configure('output', modelWidget, cameraState)
        }
      }
    })
  }
})
