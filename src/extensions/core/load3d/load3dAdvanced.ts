import { nextTick } from 'vue'

import {
  nodeToLoad3dMap,
  useLoad3d
} from '@/extensions/core/load3d/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import type { CameraConfig } from '@comfyorg/viewport3d/load3d/interfaces'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import { findNumericWidget } from '@/extensions/core/load3d/findNumericWidget'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'
import type { ComfyExtension } from '@/types/comfy'

export const load3dAdvancedExtension: ComfyExtension = {
  name: 'Comfy.Load3DAdvanced',

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    if (node.constructor.comfyClass !== 'Load3DAdvanced') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    return createExportMenuItems(load3d)
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'Load3DAdvanced') return

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
        height
      })
    })

    useLoad3d(node).waitForLoad3d(() => {
      const sceneWidget = node.widgets?.find((w) => w.name === 'viewport_state')
      if (!sceneWidget) return

      sceneWidget.serializeValue = async () => {
        const currentLoad3d = nodeToLoad3dMap.get(node)
        if (!currentLoad3d) {
          console.error('No load3d instance found for node')
          return null
        }
        return snapshotLoad3dState(node, currentLoad3d)
      }
    })
  }
}
