import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.Painter',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'Painter') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 450), Math.max(oldHeight, 550)])
  }
})
