/*
Preview Any - original implement from
https://github.com/rgthree/rgthree-comfy/blob/main/py/display_any.py
upstream requested in https://github.com/Kosinkadink/rfcs/blob/main/rfcs/0000-corenodes.md#preview-nodes
 */
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  addTextPreviewWidgets,
  updateTextPreviewWidgets
} from '@/extensions/core/textPreviewWidgets'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

useExtensionService().registerExtension({
  name: 'Comfy.PreviewAny',
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (nodeData.name !== 'PreviewAny') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, [])
      addTextPreviewWidgets(this)
    }

    const onExecuted = nodeType.prototype.onExecuted
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, [message])
      updateTextPreviewWidgets(this, message)
    }
  },
  onNodeOutputsUpdated(nodeOutputs) {
    for (const [nodeLocatorId, output] of Object.entries(nodeOutputs)) {
      const node = getNodeByLocatorId(app.rootGraph, nodeLocatorId)
      if (node?.type === 'PreviewAny') updateTextPreviewWidgets(node, output)
    }
  }
})
