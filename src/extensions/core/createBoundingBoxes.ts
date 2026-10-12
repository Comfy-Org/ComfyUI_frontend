import { useExtensionService } from '@/services/extensionService'

const INTERNAL_WIDGETS = new Set(['last_incoming'])

useExtensionService().registerExtension({
  name: 'Comfy.CreateBoundingBoxes',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CreateBoundingBoxes') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 420), Math.max(oldHeight, 560)])

    for (const widget of node.widgets ?? []) {
      if (INTERNAL_WIDGETS.has(widget.name)) widget.hidden = true
    }
  }
})
