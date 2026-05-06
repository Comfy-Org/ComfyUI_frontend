/**
 * ImageCrop — rewritten with the v2 extension API.
 *
 * v1: 13 lines, accesses node.size and node.constructor.comfyClass directly
 * v2: 12 lines, uses NodeHandle — type filtering via nodeTypes option
 */

import { defineNodeExtension } from '@/services/extensionV2Service'

defineNodeExtension({
  name: 'Comfy.ImageCrop.V2',
  nodeTypes: ['ImageCropV2'],

  nodeCreated(node) {
    const [w, h] = node.getSize()
    node.setSize([Math.max(w, 300), Math.max(h, 450)])
  }
})
