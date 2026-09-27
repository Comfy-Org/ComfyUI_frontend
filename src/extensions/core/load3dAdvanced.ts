import { nextTick } from 'vue'

import Load3DAdvanced from '@/components/load3d/Load3DAdvanced.vue'
import { nodeToLoad3dMap, useLoad3d } from '@/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import type { CameraConfig } from '@/extensions/core/load3d/interfaces'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'

const inputSpecLoad3DAdvanced: CustomInputSpec = {
  name: 'viewport_state',
  type: 'LOAD_3D_ADVANCED',
  isPreview: false
}

useExtensionService().registerExtension({
  name: 'Comfy.Load3DAdvanced',

  beforeRegisterNodeDef(_nodeType, nodeData) {
    if (nodeData.name !== 'Load3DAdvanced') return
    if (!nodeData.input?.required) return
    nodeData.input.required.viewport_state = ['LOAD_3D_ADVANCED', {}]
  },

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    if (node.constructor.comfyClass !== 'Load3DAdvanced') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    return createExportMenuItems(load3d)
  },

  getCustomWidgets() {
    return {
      LOAD_3D_ADVANCED(node) {
        const widget = new ComponentWidgetImpl({
          node,
          name: 'viewport_state',
          component: Load3DAdvanced,
          inputSpec: inputSpecLoad3DAdvanced,
          options: { hideInPanel: true }
        })

        widget.type = 'load3DAdvanced'

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'Load3DAdvanced') return

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
})
