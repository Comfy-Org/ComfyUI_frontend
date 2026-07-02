import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useExtensionService } from '@/services/extensionService'

import { useVideoTrimWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoTrimWidget'

useExtensionService().registerExtension({
  name: 'Comfy.LoadVideoTrimPrototype',

  nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'LoadVideo') return

    node.hideOutputImages = true
    node.setSize([Math.max(node.size[0], 350), node.size[1]])

    useVideoTrimWidget(node)
  }
})
