import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.ColorBalance',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'ColorBalance') return

    node.hideOutputImages = true
    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 350), Math.max(oldHeight, 450)])
  }
})
