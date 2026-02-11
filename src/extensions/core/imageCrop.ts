import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.ImageCrop',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'ImageCropV2') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 450)])
  }
})
