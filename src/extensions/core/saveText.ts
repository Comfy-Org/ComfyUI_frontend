import { addTextPreviewWidgets } from '@/extensions/core/textPreviewWidgets'
import type { ComfyExtension } from '@/types/comfy'

export const saveTextExtension: ComfyExtension = {
  name: 'Comfy.saveText',
  nodeCreated(node) {
    if (node.constructor.comfyClass === 'SaveText') addTextPreviewWidgets(node)
  }
}
