import { nextTick } from 'vue'

import Load3DViewerContent from '@/extensions/core/load3d/components/Load3dViewerContent.vue'
import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/extensions/core/load3d/components/load3dViewerDialog'
import {
  getLoad3dOutputCache,
  getLoad3dSceneRevision,
  isLoad3dSceneDirty,
  markLoad3dSceneDirty,
  nodeToLoad3dMap,
  setLoad3dOutputCache,
  useLoad3d
} from '@/extensions/core/load3d/composables/useLoad3d'
import type { Load3dCachedOutput } from '@/extensions/core/load3d/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import type {
  CameraConfig,
  CameraState,
  LoadFolder,
  Model3DInfo
} from '@comfyorg/viewport3d/load3d/interfaces'
import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import { findNumericWidget } from '@/extensions/core/load3d/findNumericWidget'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type { Model3DOutput } from '@/extensions/core/load3d/model3dOutput'
import { readModel3DOutput } from '@/extensions/core/load3d/model3dOutput'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { useToast } from '@/components/ui/toast/toastStore'
import type {
  NodeExecutionOutput,
  NodeOutputWith
} from '@/platform/remote/comfyui/execution/types'
import { reportError } from '@/platform/telemetry/reportError'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

type Matrix = number[][]

/** Extra captures allowed when the scene changes mid-capture. */
const MAX_STALE_CAPTURE_RETRIES = 2

type Load3dPreviewOutput = NodeOutputWith<{
  result?: [string?, CameraState?, string?, Matrix?, Matrix?]
}>
import { ComfyApp, app } from '@/scripts/app'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComfyExtension } from '@/types/comfy'
import { isLoad3dNode } from '@/utils/litegraphUtil'
import { selectedCanvasNodes } from '@/renderer/core/canvas/litegraph/selectionAdapter'

export const load3dExtension: ComfyExtension = {
  name: 'Comfy.Load3D',
  commands: [
    {
      id: 'Comfy.3DViewer.Open3DViewer',
      icon: 'pi pi-pencil',
      label: 'Open 3D Viewer (Beta) for Selected Node',
      function: () => {
        const selectedNodes = selectedCanvasNodes(app.canvas)
        if (selectedNodes.length !== 1) return

        const [selectedNode] = selectedNodes
        if (!isLoad3dNode(selectedNode)) return

        ComfyApp.copyToClipspace(selectedNode)
        ComfyApp.clipspace_return_node = selectedNode

        const props = { node: selectedNode }

        useDialogStore().showDialog({
          key: 'global-load3d-viewer',
          title: t('load3d.viewer.title'),
          component: Load3DViewerContent,
          props: props,
          dialogComponentProps: {
            ...LOAD3D_VIEWER_DIALOG_PROPS,
            onClose: async () => {
              await useLoad3dService().handleViewerClose(props.node)
            }
          }
        })
      }
    }
  ],
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
      const width = findNumericWidget(node.widgets, 'width')
      const height = findNumericWidget(node.widgets, 'height')
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

          for (let attempt = 0; ; attempt++) {
            if (!isLoad3dSceneDirty(node)) {
              const cached = getLoad3dOutputCache(node)
              if (cached) return cached
            }

            const sceneRevision = getLoad3dSceneRevision(node)

            // A model swap (user or agent) may still be loading. Capture the
            // scene the queue will actually run, not the one being replaced.
            await currentLoad3d.whenLoadIdle()

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
              const recording = await Load3dUtils.uploadTempImage(
                recordingData,
                'recording',
                'mp4'
              )
              returnVal.recording = `threed/${recording.name} [temp]`
            }

            if (setLoad3dOutputCache(node, returnVal, sceneRevision)) {
              return returnVal
            }

            if (attempt >= MAX_STALE_CAPTURE_RETRIES) {
              reportError(
                new Error('Load3D scene did not stabilize during capture'),
                {
                  surface: 'assets',
                  errorType: 'error_capturing_load3d_scene_unstable'
                }
              )
              return null
            }
          }
        }
      }
    })
  }
}

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

    if (bgImagePath) void load3d.setBackgroundImage(bgImagePath)

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

export const preview3DExtension: ComfyExtension = {
  name: 'Comfy.Preview3D',

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
            useToast().warning(msg)
          }

          const cameraState = result?.[1]
          const bgImagePath = result?.[2]
          const extrinsics = result?.[3]
          const intrinsics = result?.[4]

          const modelFilePath = filePath?.replaceAll('\\', '/')
          modelWidget.value = modelFilePath

          node.properties['Last Time Model File'] = modelFilePath

          const settings = {
            loadFolder: 'output',
            modelWidget: modelWidget,
            cameraState: cameraState,
            bgImagePath: bgImagePath,
            silentOnNotFound: true
          }

          config.configure(settings)

          if (bgImagePath) void load3d.setBackgroundImage(bgImagePath)

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
}

function applyPreview3DAdvancedResult(
  node: LGraphNode,
  load3d: Load3d,
  reported: Model3DOutput,
  loadFolder: LoadFolder,
  comfyClass: string
): void {
  const normalizedPath = reported.filePath.replaceAll('\\', '/')
  const folder = reported.folder ?? loadFolder
  node.properties['Last Time Model File'] = normalizedPath
  node.properties['Last Time Model Folder'] = folder

  const config = new Load3DConfiguration(load3d, node.properties)
  config.configureForSaveMesh(folder, normalizedPath, {
    silentOnNotFound: true
  })

  const { cameraState, modelTransform } = reported
  if (!cameraState && !modelTransform) return

  const targetGeneration = load3d.currentLoadGeneration
  void load3d
    .whenLoadIdle()
    .then(() => {
      if (load3d.currentLoadGeneration !== targetGeneration) return
      if (cameraState) load3d.setCameraState(cameraState)
      if (modelTransform) load3d.applyModelTransform(modelTransform)
    })
    .catch((error) => {
      console.error(
        `Failed to apply input camera_info / model_3d_info from ${comfyClass}:`,
        error
      )
    })
}

function createPreview3DAdvancedExtension(
  comfyClass: string,
  extensionName: string,
  loadFolder: LoadFolder
): ComfyExtension {
  return {
    name: extensionName,

    onNodeOutputsUpdated(
      nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
    ) {
      for (const [locatorId, output] of Object.entries(nodeOutputs)) {
        const reported = readModel3DOutput(output)
        if (!reported) continue

        const node = getNodeByLocatorId(app.rootGraph, locatorId)
        if (!node || node.constructor.comfyClass !== comfyClass) continue

        useLoad3d(node).waitForLoad3d((load3d) => {
          applyPreview3DAdvancedResult(
            node,
            load3d,
            reported,
            loadFolder,
            comfyClass
          )
        })
      }
    },

    getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
      if (node.constructor.comfyClass !== comfyClass) return []

      const load3d = useLoad3dService().getLoad3d(node)
      if (!load3d) return []

      if (load3d.isSplatModel()) return []

      return createExportMenuItems(load3d)
    },

    async nodeCreated(node: LGraphNode) {
      if (node.constructor.comfyClass !== comfyClass) return

      const [oldWidth, oldHeight] = node.size

      node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

      await nextTick()

      const onExecuted = node.onExecuted
      const { onLoad3dReady, waitForLoad3d } = useLoad3d(node)

      onLoad3dReady((load3d) => {
        const lastTimeModelFile = node.properties['Last Time Model File']
        if (!lastTimeModelFile) return

        const lastTimeModelFolder = node.properties['Last Time Model Folder']
        const folder =
          lastTimeModelFolder === 'temp' || lastTimeModelFolder === 'output'
            ? lastTimeModelFolder
            : loadFolder

        const config = new Load3DConfiguration(load3d, node.properties)
        config.configureForSaveMesh(folder, lastTimeModelFile as string, {
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
              `Failed to restore camera state for ${comfyClass}:`,
              error
            )
          })
      })

      waitForLoad3d((load3d) => {
        const sceneWidget = node.widgets?.find(
          (w) => w.name === 'viewport_state'
        )
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

          const cameraConfig: CameraConfig = (node.properties[
            'Camera Config'
          ] as CameraConfig | undefined) || {
            cameraType: currentLoad3d.getCurrentCameraType(),
            fov: currentLoad3d.cameraManager.perspectiveCamera.fov
          }
          const cameraState = currentLoad3d.getCameraState()
          cameraConfig.state = cameraState
          node.properties['Camera Config'] = cameraConfig

          const modelInfo = currentLoad3d.getModelInfo()
          const model_3d_info: Model3DInfo = modelInfo ? [modelInfo] : []

          return {
            image: '',
            mask: '',
            normal: '',
            camera_info: cameraState,
            recording: '',
            model_3d_info
          }
        }

        node.onExecuted = function (output: NodeExecutionOutput) {
          onExecuted?.call(this, output)

          const reported = readModel3DOutput(output)
          if (!reported) {
            const msg = t('toastMessages.unableToGetModelFilePath')
            console.error(msg)
            useToast().warning(msg)
            return
          }

          applyPreview3DAdvancedResult(
            node,
            resolveLoad3d(),
            reported,
            loadFolder,
            comfyClass
          )
        }
      })
    }
  }
}

export const preview3DAdvancedExtension: ComfyExtension =
  createPreview3DAdvancedExtension(
    'Preview3DAdvanced',
    'Comfy.Preview3DAdvanced',
    'temp'
  )

export const save3DAdvancedExtension: ComfyExtension =
  createPreview3DAdvancedExtension(
    'Save3DAdvanced',
    'Comfy.Save3DAdvanced',
    'output'
  )
