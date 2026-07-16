import { nextTick } from 'vue'

import CameraInfo from '@/components/cameraInfo/CameraInfo.vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CreateCameraInfo',

  getCustomWidgets() {
    return {
      CAMERA_INFO_STATE(node) {
        const widget = new ComponentWidgetImpl({
          node,
          name: 'camera_info_state',
          component: CameraInfo,
          inputSpec: {
            name: 'camera_info_state',
            type: 'CAMERA_INFO_STATE',
            isPreview: false
          },
          options: {}
        })
        widget.type = 'cameraInfo'
        addWidget(node, widget)
        return { widget }
      }
    }
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'CreateCameraInfo') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 360), Math.max(oldHeight, 480)])

    await nextTick()
  }
})
