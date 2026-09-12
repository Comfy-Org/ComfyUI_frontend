/**
 * ImageCrop — rewritten with the v2 extension API.
 *
 * v1: 13 lines, accesses node.size and node.constructor.comfyClass directly
 * v2: 12 lines, uses NodeHandle — type filtering via nodeTypes option
 */

import { defineNode, type NodeHandle } from '@/extension-api'

defineNode({
  name: 'Comfy.ImageCrop.V2',
  nodeTypes: ['ImageCropV2'],

  nodeCreated(node: NodeHandle) {
    const [w, h] = node.getSize()
    node.setSize([Math.max(w, 300), Math.max(h, 450)])
  }
})
