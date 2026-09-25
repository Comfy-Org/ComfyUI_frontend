import { defineAsyncComponent } from 'vue'

import { CAMERA_ANGLE_VIEW_WIDGET_NAME } from '@/extensions/core/cameraAngle/types'
import type { CameraAngleViewMode } from '@/extensions/core/cameraAngle/types'
import { isViewMode } from '@/extensions/core/cameraAngle/widgetBridge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'

const CameraAngle = defineAsyncComponent(
  () => import('@/components/cameraAngle/CameraAngle.vue')
)

const NODE_CLASS = 'CameraAngle'
const MIN_WIDTH = 360
const MIN_HEIGHT = 480

useExtensionService().registerExtension({
  name: 'Comfy.CameraAngle',

  getCustomWidgets() {
    return {
      CAMERA_ANGLE_VIEW(node) {
        let viewMode: CameraAngleViewMode = 'camera'
        const widget = new ComponentWidgetImpl<string | object>({
          node,
          name: CAMERA_ANGLE_VIEW_WIDGET_NAME,
          component: CameraAngle,
          inputSpec: {
            name: CAMERA_ANGLE_VIEW_WIDGET_NAME,
            type: 'CAMERA_ANGLE_VIEW',
            isPreview: false
          },
          options: {
            serialize: false,
            getValue: () => viewMode,
            setValue: (value) => {
              if (isViewMode(value)) viewMode = value
            }
          }
        })
        widget.type = 'cameraAngle'
        addWidget(node, widget)
        return { widget }
      }
    }
  },

  nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== NODE_CLASS) return
    const [width, height] = node.size
    node.setSize([Math.max(width, MIN_WIDTH), Math.max(height, MIN_HEIGHT)])
  }
})
