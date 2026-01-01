import { cropWidgetChangeHandlers } from '@/composables/useImageCrop'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.ImageCrop',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'ImageCrop') return

    node.addWidget('imagecrop', 'crop_preview', [], () => {}, {
      serialize: false
    })

    const paramNames = ['x', 'y', 'width', 'height'] as const

    for (const paramName of paramNames) {
      const widget = node.widgets?.find((w) => w.name === paramName)
      if (widget) {
        widget.callback = (value: number) => {
          const handler = cropWidgetChangeHandlers.get(String(node.id))
          handler?.(paramName, value)
        }
      }
    }

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 400)])
  }
})
