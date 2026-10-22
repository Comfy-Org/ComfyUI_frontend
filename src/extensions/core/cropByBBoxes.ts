import { useExtensionService } from '@/services/extensionService'

const PREVIEW_WIDGET_NAME = '$$crop_bboxes_preview'

useExtensionService().registerExtension({
  name: 'Comfy.CropByBBoxes',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CropByBBoxes') return

    const widget = node.addWidget(
      'cropbboxespreview',
      PREVIEW_WIDGET_NAME,
      null,
      () => {},
      { serialize: false }
    )
    widget.serialize = false

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 320), Math.max(oldHeight, 640)])
  }
})
