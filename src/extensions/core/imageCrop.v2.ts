/**
 * ImageCrop — rewritten with the v2 extension API.
 *
 * v1: 13 lines, accesses node.size and node.constructor.comfyClass directly
 * v2: 12 lines, uses NodeHandle — type filtering via nodeTypes option
 */

import { defineNode, type NodeHandle } from '@/extension-api'
import { useExtensionStore } from '@/stores/extensionStore'

defineNode({
  name: 'Comfy.ImageCrop.V2',
  nodeTypes: ['ImageCropV2'],

  nodeCreated(node: NodeHandle) {
    // RFR-12144-1 strangler-fig guard (D6): no-op if v1 is registered so the
    // legacy path owns sizing during Phase A coexistence.
    if (useExtensionStore().isExtensionInstalled('Comfy.ImageCrop')) return

    const [w, h] = node.getSize()
    node.setSize([Math.max(w, 300), Math.max(h, 450)])
  }
})
