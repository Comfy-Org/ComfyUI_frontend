import { nextTick } from 'vue'

import Load3D from '@/components/load3d/Load3D.vue'
import Load3DViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import {
  type Load3dCachedOutput,
  getLoad3dOutputCache,
  isLoad3dSceneDirty,
  markLoad3dSceneDirty,
  nodeToLoad3dMap,
  setLoad3dOutputCache,
  useLoad3d
} from '@/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import type {
  CameraConfig,
  CameraState,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import {
  LOAD3D_NONE_MODEL,
  SUPPORTED_EXTENSIONS_ACCEPT
} from '@/extensions/core/load3d/constants'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { IStringWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { NodeExecutionOutput, NodeOutputWith } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

type Matrix = number[][]
type Load3dPreviewOutput = NodeOutputWith<{
  result?: [string?, CameraState?, string?, Matrix?, Matrix?]
}>
type Preview3DAdvancedOutput = NodeOutputWith<{
  result?: [string?, CameraState?, Model3DInfo?]
}>
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { ComfyApp, app } from '@/scripts/app'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'
import { isLoad3dNode } from '@/utils/litegraphUtil'

const inputSpecLoad3D: CustomInputSpec = {
  name: 'image',
  type: 'Load3D',
  isPreview: false
}

const inputSpecPreview3D: CustomInputSpec = {
  name: 'image',
  type: 'Preview3D',
  isPreview: true
}

async function handleModelUpload(files: FileList, node: LGraphNode) {
  if (!files?.length) return

  const modelWidget = node.widgets?.find((w) => w.name === 'model_file') as
    | IStringWidget
    | undefined

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

    useLoad3d(node).waitForLoad3d((load3d) => {
      try {
        load3d.loadModel(modelUrl)
      } catch (error) {
        useToastStore().addAlert(t('toastMessages.failedToLoadModel'))
      }
    })

    if (uploadPath && modelWidget) {
      if (!modelWidget.options?.values?.includes(uploadPath)) {
        modelWidget.options?.values?.push(uploadPath)
      }

      modelWidget.value = uploadPath
    }

    markLoad3dSceneDirty(node)
  } catch (error) {
    console.error('Model upload failed:', error)
    useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
  }
}

async function handleResourcesUpload(files: FileList, node: LGraphNode) {
  if (!files?.length) return

  try {
    const resourceFolder = (node.properties['Resource Folder'] as string) || ''

    const subfolder = resourceFolder.trim()
      ? `3d/${resourceFolder.trim()}`
      : '3d'

    await Load3dUtils.uploadMultipleFiles(files, subfolder)
    markLoad3dSceneDirty(node)
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
    },
    {
      id: 'Comfy.Load3D.PLYEngine',
      category: ['3D', 'PointCloud', 'Point Cloud Engine'],
      name: 'Point Cloud Engine',
      tooltip:
        'Select the engine for loading point cloud PLY files. "threejs" uses the native Three.js PLYLoader (handles binary + ASCII, mesh-capable). "fastply" uses an optimized parser for ASCII PLY files. 3D Gaussian Splat PLYs are detected automatically and always rendered via sparkjs regardless of this setting.',
      type: 'combo',
      options: ['threejs', 'fastply'],
      defaultValue: 'threejs',
      migrateDeprecatedValue: (value) =>
        value === 'sparkjs' ? 'threejs' : value,
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
            renderer: 'reka',
            size: 'full',
            contentClass:
              'w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] max-h-[80vh]',
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
    const VIEWPORT_STATE_NODES = new Set([
      'Preview3DAdvanced',
      'PreviewGaussianSplat',
      'PreviewPointCloud'
    ])
    return {
      LOAD_3D(node) {
        const inputName = VIEWPORT_STATE_NODES.has(node.constructor.comfyClass)
          ? 'viewport_state'
          : 'image'
        const hasModelFileWidget = node.widgets?.some(
          (w) => w.name === 'model_file'
        )
        if (hasModelFileWidget) {
          const fileInput = createFileInput(SUPPORTED_EXTENSIONS_ACCEPT, false)

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
            const modelWidget = node.widgets?.find(
              (w) => w.name === 'model_file'
            )
            if (modelWidget) {
              modelWidget.value = LOAD3D_NONE_MODEL
            }
            markLoad3dSceneDirty(node)
          })
        }

        const widget = new ComponentWidgetImpl({
          node: node,
          name: inputName,
          component: Load3D,
          inputSpec: { ...inputSpecLoad3D, name: inputName },
          options: {}
        })

        widget.type = 'load3D'

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    // Only show menu items for Load3D nodes
    if (node.constructor.comfyClass !== 'Load3D') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    if (load3d.isSplatModel()) return []

    return createExportMenuItems(load3d)
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'Load3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 600)])

    await nextTick()

    useLoad3d(node).onLoad3dReady((load3d) => {
      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')
      if (!modelWidget || !width || !height) return

      const cameraConfig = node.properties['Camera Config'] as
        | CameraConfig
        | undefined
      const cameraState = cameraConfig?.state

      const config = new Load3DConfiguration(load3d, node.properties)
      config.configure({
        loadFolder: 'input',
        modelWidget,
        cameraState,
        width,
        height,
        onSceneInvalidated: () => markLoad3dSceneDirty(node)
      })
    })

    useLoad3d(node).waitForLoad3d(() => {
      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')
      const sceneWidget = node.widgets?.find((w) => w.name === 'image')

      if (modelWidget && width && height && sceneWidget) {
        sceneWidget.serializeValue = async () => {
          const currentLoad3d = nodeToLoad3dMap.get(node)
          if (!currentLoad3d) {
            console.error('No load3d instance found for node')
            return null
          }

          if (!isLoad3dSceneDirty(node)) {
            const cached = getLoad3dOutputCache(node)
            if (cached) return cached
          }

          const { camera_info, model_3d_info } = snapshotLoad3dState(
            node,
            currentLoad3d
          )

          const {
            scene: imageData,
            mask: maskData,
            normal: normalData
          } = await currentLoad3d.captureScene(
            width.value as number,
            height.value as number
          )

          const [data, dataMask, dataNormal] = await Promise.all([
            Load3dUtils.uploadTempImage(imageData, 'scene'),
            Load3dUtils.uploadTempImage(maskData, 'scene_mask'),
            Load3dUtils.uploadTempImage(normalData, 'scene_normal')
          ])

          currentLoad3d.handleResize()

          const returnVal: Load3dCachedOutput = {
            image: `threed/${data.name} [temp]`,
            mask: `threed/${dataMask.name} [temp]`,
            normal: `threed/${dataNormal.name} [temp]`,
            camera_info,
            recording: '',
            model_3d_info
          }

          const recordingData = currentLoad3d.getRecordingData()

          if (recordingData) {
            const [recording] = await Promise.all([
              Load3dUtils.uploadTempImage(recordingData, 'recording', 'mp4')
            ])
            returnVal.recording = `threed/${recording.name} [temp]`
          }

          setLoad3dOutputCache(node, returnVal)

          return returnVal
        }
      }
    })
  }
})

function applyPreview3DOutput(
  node: LGraphNode,
  result: NonNullable<Load3dPreviewOutput['result']>
): void {
  const filePath = result[0]
  const cameraState = result[1]
  const bgImagePath = result[2]
  const extrinsics = result[3]
  const intrinsics = result[4]
  if (!filePath) return

  const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
  if (!modelWidget) return

  const normalizedPath = filePath.replaceAll('\\', '/')

  // Always re-apply, even when the file path matches: the same model file
  // can arrive with a new camera state, background image, or matrices, and
  // a path-only guard would silently drop those updates and diverge from
  // the active `node.onExecuted` path which always reapplies.
  modelWidget.value = normalizedPath
  node.properties['Last Time Model File'] = normalizedPath

  useLoad3d(node).waitForLoad3d((load3d) => {
    const config = new Load3DConfiguration(load3d, node.properties)
    config.configure({
      loadFolder: 'output',
      modelWidget,
      cameraState,
      bgImagePath,
      silentOnNotFound: true
    })

    if (bgImagePath) load3d.setBackgroundImage(bgImagePath)

    if (extrinsics && intrinsics) {
      const targetGeneration = load3d.currentLoadGeneration
      void load3d
        .whenLoadIdle()
        .then(() => {
          if (load3d.currentLoadGeneration !== targetGeneration) return
          load3d.setCameraFromMatrices(extrinsics, intrinsics)
        })
        .catch((error) => {
          console.error(
            'Failed to apply camera matrices from Preview3D output:',
            error
          )
        })
    }
  })
}

useExtensionService().registerExtension({
  name: 'Comfy.Preview3D',

  async beforeRegisterNodeDef(
    _nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if ('Preview3D' === nodeData.name) {
      // @ts-expect-error InputSpec is not typed correctly
      nodeData.input.required.image = ['PREVIEW_3D']
    }
  },

  onNodeOutputsUpdated(
    nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
  ) {
    for (const [locatorId, output] of Object.entries(nodeOutputs)) {
      const result = (output as Load3dPreviewOutput).result
      if (!result?.[0]) continue

      const node = getNodeByLocatorId(app.rootGraph, locatorId)
      if (!node || node.constructor.comfyClass !== 'Preview3D') continue

      applyPreview3DOutput(node, result)
    }
  },

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    // Only show menu items for Preview3D nodes
    if (node.constructor.comfyClass !== 'Preview3D') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    if (load3d.isSplatModel()) return []

    return createExportMenuItems(load3d)
  },

  getCustomWidgets() {
    return {
      PREVIEW_3D(node) {
        const widget = new ComponentWidgetImpl({
          node,
          name: inputSpecPreview3D.name,
          component: Load3D,
          inputSpec: inputSpecPreview3D,
          options: {}
        })

        widget.type = 'load3D'

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'Preview3D') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    const onExecuted = node.onExecuted

    useLoad3d(node).onLoad3dReady((load3d) => {
      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
      if (!modelWidget) return

      const lastTimeModelFile = node.properties['Last Time Model File']
      if (!lastTimeModelFile) return

      modelWidget.value = lastTimeModelFile

      const cameraConfig = node.properties['Camera Config'] as
        | CameraConfig
        | undefined
      const cameraState = cameraConfig?.state

      const config = new Load3DConfiguration(load3d, node.properties)
      config.configure({
        loadFolder: 'output',
        modelWidget,
        cameraState,
        silentOnNotFound: true
      })
    })

    useLoad3d(node).waitForLoad3d((load3d) => {
      const config = new Load3DConfiguration(load3d, node.properties)

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

      if (modelWidget) {
        node.onExecuted = function (output: Load3dPreviewOutput) {
          onExecuted?.call(this, output)

          const result = output.result
          const filePath = result?.[0]

          if (!filePath) {
            const msg = t('toastMessages.unableToGetModelFilePath')
            console.error(msg)
            useToastStore().addAlert(msg)
          }

          const cameraState = result?.[1]
          const bgImagePath = result?.[2]
          const extrinsics = result?.[3]
          const intrinsics = result?.[4]

          modelWidget.value = filePath?.replaceAll('\\', '/')

          node.properties['Last Time Model File'] = modelWidget.value

          const settings = {
            loadFolder: 'output',
            modelWidget: modelWidget,
            cameraState: cameraState,
            bgImagePath: bgImagePath,
            silentOnNotFound: true
          }

          config.configure(settings)

          if (bgImagePath) {
            load3d.setBackgroundImage(bgImagePath)
          }

          if (filePath && extrinsics && intrinsics) {
            // configure(settings) above triggered loadModel for this
            // execution; capture its generation so that if a newer
            // execution queues another load before whenLoadIdle resolves,
            // we don't apply this execution's matrices on top of that
            // newer model.
            const targetGeneration = load3d.currentLoadGeneration
            void load3d
              .whenLoadIdle()
              .then(() => {
                if (load3d.currentLoadGeneration !== targetGeneration) return
                load3d.setCameraFromMatrices(extrinsics, intrinsics)
              })
              .catch((error) => {
                console.error(
                  'Failed to apply camera matrices from Preview3D output:',
                  error
                )
              })
          }
        }
      }
    })
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.Preview3DAdvanced',

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    if (node.constructor.comfyClass !== 'Preview3DAdvanced') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    if (load3d.isSplatModel()) return []

    return createExportMenuItems(load3d)
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'Preview3DAdvanced') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    const onExecuted = node.onExecuted

    useLoad3d(node).onLoad3dReady((load3d) => {
      const lastTimeModelFile = node.properties['Last Time Model File']
      if (!lastTimeModelFile) return

      const config = new Load3DConfiguration(load3d, node.properties)
      config.configureForSaveMesh('temp', lastTimeModelFile as string, {
        silentOnNotFound: true
      })

      const cameraConfig = node.properties['Camera Config'] as
        | CameraConfig
        | undefined
      const cameraState = cameraConfig?.state
      if (!cameraState) return

      const targetGeneration = load3d.currentLoadGeneration
      void load3d
        .whenLoadIdle()
        .then(() => {
          if (load3d.currentLoadGeneration !== targetGeneration) return
          load3d.setCameraState(cameraState)
          load3d.forceRender()
        })
        .catch((error) => {
          console.error(
            'Failed to restore camera state for Preview3DAdvanced:',
            error
          )
        })
    })

    useLoad3d(node).waitForLoad3d((load3d) => {
      const sceneWidget = node.widgets?.find((w) => w.name === 'viewport_state')
      if (!sceneWidget) return

      const resolveLoad3d = () => nodeToLoad3dMap.get(node) ?? load3d

      const widthWidget = node.widgets?.find((w) => w.name === 'width')
      const heightWidget = node.widgets?.find((w) => w.name === 'height')
      if (widthWidget && heightWidget) {
        load3d.setTargetSize(
          widthWidget.value as number,
          heightWidget.value as number
        )
        widthWidget.callback = (value: number) => {
          resolveLoad3d().setTargetSize(value, heightWidget.value as number)
        }
        heightWidget.callback = (value: number) => {
          resolveLoad3d().setTargetSize(widthWidget.value as number, value)
        }
      }

      sceneWidget.serializeValue = async () => {
        const currentLoad3d = nodeToLoad3dMap.get(node)
        if (!currentLoad3d) {
          console.error('No load3d instance found for node')
          return null
        }

        const cameraConfig: CameraConfig = (node.properties['Camera Config'] as
          | CameraConfig
          | undefined) || {
          cameraType: currentLoad3d.getCurrentCameraType(),
          fov: currentLoad3d.cameraManager.perspectiveCamera.fov
        }
        cameraConfig.state = currentLoad3d.getCameraState()
        node.properties['Camera Config'] = cameraConfig

        const modelInfo = currentLoad3d.getModelInfo()
        const model_3d_info: Model3DInfo = modelInfo ? [modelInfo] : []

        return {
          image: '',
          mask: '',
          normal: '',
          camera_info: cameraConfig.state || null,
          recording: '',
          model_3d_info
        }
      }

      node.onExecuted = function (output: Preview3DAdvancedOutput) {
        onExecuted?.call(this, output)

        const result = output.result
        const filePath = result?.[0]

        if (!filePath) {
          const msg = t('toastMessages.unableToGetModelFilePath')
          console.error(msg)
          useToastStore().addAlert(msg)
          return
        }

        const normalizedPath = filePath.replaceAll('\\', '/')
        node.properties['Last Time Model File'] = normalizedPath

        const currentLoad3d = resolveLoad3d()
        const config = new Load3DConfiguration(currentLoad3d, node.properties)
        config.configureForSaveMesh('temp', normalizedPath, {
          silentOnNotFound: true
        })

        const cameraState = result?.[1]
        const modelTransform = result?.[2]?.[0]
        if (cameraState || modelTransform) {
          const targetGeneration = currentLoad3d.currentLoadGeneration
          void currentLoad3d
            .whenLoadIdle()
            .then(() => {
              if (currentLoad3d.currentLoadGeneration !== targetGeneration)
                return
              if (cameraState) currentLoad3d.setCameraState(cameraState)
              if (modelTransform)
                currentLoad3d.applyModelTransform(modelTransform)
            })
            .catch((error) => {
              console.error(
                'Failed to apply input camera_info / model_3d_info from Preview3DAdvanced:',
                error
              )
            })
        }
      }
    })
  }
})
