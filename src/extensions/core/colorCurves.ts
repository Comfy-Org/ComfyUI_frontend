import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.ColorCurves',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'ColorCurves') return

    node.hideOutputImages = true
    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 350), Math.max(oldHeight, 500)])
  }
})
