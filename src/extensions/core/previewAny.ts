import type { ComfyExtension } from '@/types/comfy'
import { addTextPreviewWidgets } from '@/extensions/core/textPreviewWidgets'

export const previewAnyExtension: ComfyExtension = {
  name: 'Comfy.PreviewAny',
  nodeCreated(node) {
    if (node.constructor.comfyClass === 'PreviewAny')
      addTextPreviewWidgets(node)
  }
}
