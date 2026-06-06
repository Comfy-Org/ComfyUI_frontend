import { nextTick } from 'vue'

import { nodeToLoad3dMap, useLoad3d } from '@/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import type {
  CameraConfig,
  CameraState,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'
import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { NodeExecutionOutput, NodeOutputWith } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'
import type { ComfyExtension } from '@/types/comfy'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

type PreviewOutput = NodeOutputWith<{
  result?: [string?, CameraState?, Model3DInfo?]
}>

function applyResultToLoad3d(
  node: LGraphNode,
  load3d: Load3d,
  filePath: string,
  cameraState: CameraState | undefined
): void {
  const normalizedPath = filePath.replaceAll('\\', '/')
  node.properties['Last Time Model File'] = normalizedPath
  if (cameraState) {
    const existing = node.properties['Camera Config'] as
      | CameraConfig
      | undefined
    node.properties['Camera Config'] = {
      cameraType: load3d.getCurrentCameraType(),
      fov: 75,
      ...existing,
      state: cameraState
    }
  }

  const config = new Load3DConfiguration(load3d, node.properties)
  config.configureForSaveMesh('temp', normalizedPath, {
    silentOnNotFound: true
  })

  const targetGeneration = load3d.currentLoadGeneration
  void load3d.whenLoadIdle().then(() => {
    if (load3d.currentLoadGeneration !== targetGeneration) return
    if (cameraState) load3d.setCameraState(cameraState)
    load3d.forceRender()
  })
}

function createPreview3DExtension(
  comfyClass: string,
  extensionName: string
): ComfyExtension {
  const applyPreviewOutput = (
    node: LGraphNode,
    result: NonNullable<PreviewOutput['result']>
  ): void => {
    const filePath = result[0]
    const cameraState = result[1]
    if (!filePath) return

    useLoad3d(node).waitForLoad3d((load3d) => {
      applyResultToLoad3d(node, load3d, filePath, cameraState)
    })
  }

  return {
    name: extensionName,

    onNodeOutputsUpdated(
      nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
    ) {
      for (const [locatorId, output] of Object.entries(nodeOutputs)) {
        const result = (output as PreviewOutput).result
        if (!result?.[0]) continue

        const node = getNodeByLocatorId(app.rootGraph, locatorId)
        if (!node || node.constructor.comfyClass !== comfyClass) continue

        applyPreviewOutput(node, result)
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

        const config = new Load3DConfiguration(load3d, node.properties)
        config.configureForSaveMesh('temp', lastTimeModelFile as string, {
          silentOnNotFound: true
        })

        const cameraConfig = node.properties['Camera Config'] as
          | CameraConfig
          | undefined
        const cameraState = cameraConfig?.state
        const targetGeneration = load3d.currentLoadGeneration
        void load3d.whenLoadIdle().then(() => {
          if (load3d.currentLoadGeneration !== targetGeneration) return
          if (cameraState) load3d.setCameraState(cameraState)
          load3d.forceRender()
        })
      })

      waitForLoad3d((load3d) => {
        const sceneWidget = node.widgets?.find(
          (w) => w.name === 'viewport_state'
        )
        const widthWidget = node.widgets?.find((w) => w.name === 'width')
        const heightWidget = node.widgets?.find((w) => w.name === 'height')

        if (widthWidget && heightWidget) {
          load3d.setTargetSize(
            widthWidget.value as number,
            heightWidget.value as number
          )
          widthWidget.callback = (value: number) => {
            load3d.setTargetSize(value, heightWidget.value as number)
          }
          heightWidget.callback = (value: number) => {
            load3d.setTargetSize(widthWidget.value as number, value)
          }
        }

        if (sceneWidget) {
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
        }

        node.onExecuted = function (output: PreviewOutput) {
          onExecuted?.call(this, output)

          const result = output.result
          const filePath = result?.[0]

          if (!filePath) {
            const msg = t('toastMessages.unableToGetModelFilePath')
            console.error(msg)
            useToastStore().addAlert(msg)
            return
          }

          applyResultToLoad3d(node, load3d, filePath, result?.[1])
        }
      })
    }
  }
}

useExtensionService().registerExtension(
  createPreview3DExtension('PreviewGaussianSplat', 'Comfy.PreviewGaussianSplat')
)
useExtensionService().registerExtension(
  createPreview3DExtension('PreviewPointCloud', 'Comfy.PreviewPointCloud')
)
