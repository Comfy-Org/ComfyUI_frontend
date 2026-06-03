import type { Ref } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { usePragmaticDroppable } from '@/composables/usePragmaticDragAndDrop'
import type { LGraphNode, Point } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app as comfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { ComfyModelDef } from '@/stores/modelStore'
import type { ModelNodeProvider } from '@/stores/modelToNodeStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const isCopyDropSource = (type: unknown) =>
  type === 'tree-explorer-node' ||
  type === 'cloud-model-asset' ||
  type === 'partner-node'

export const useCanvasDrop = (canvasRef: Ref<HTMLCanvasElement | null>) => {
  const modelToNodeStore = useModelToNodeStore()
  const litegraphService = useLitegraphService()
  const workflowService = useWorkflowService()

  usePragmaticDroppable(() => canvasRef.value, {
    getDropEffect: (args): Exclude<DataTransfer['dropEffect'], 'none'> =>
      isCopyDropSource(args.source.data.type) ? 'copy' : 'move',
    onDrop: async (event) => {
      const loc = event.location.current.input
      const dndData = event.source.data

      if (dndData.type === 'cloud-model-asset') {
        const asset = dndData.asset as AssetItem
        const conv = useSharedCanvasPositionConversion()
        const basePos = conv.clientPosToCanvasPos([loc.clientX, loc.clientY])
        createModelNodeFromAsset(asset, { position: basePos })
        return
      }

      if (dndData.type === 'partner-node') {
        const nodeDef = dndData.nodeDef as ComfyNodeDefImpl
        const conv = useSharedCanvasPositionConversion()
        const basePos = conv.clientPosToCanvasPos([loc.clientX, loc.clientY])
        const pos: Point = [...basePos]
        pos[1] += LiteGraph.NODE_TITLE_HEIGHT
        litegraphService.addNodeOnGraph(nodeDef, { pos })
        return
      }

      if (dndData.type === 'tree-explorer-node') {
        const node = dndData.data as RenderedTreeExplorerNode
        const conv = useSharedCanvasPositionConversion()
        const basePos = conv.clientPosToCanvasPos([loc.clientX, loc.clientY])

        if (node.data instanceof ComfyNodeDefImpl) {
          const nodeDef = node.data
          const pos: Point = [...basePos]
          // Add an offset on y to make sure after adding the node, the cursor
          // is on the node (top left corner)
          pos[1] += LiteGraph.NODE_TITLE_HEIGHT
          litegraphService.addNodeOnGraph(nodeDef, { pos })
        } else if (node.data instanceof ComfyModelDef) {
          const model = node.data
          const pos = basePos
          const nodeAtPos = comfyApp.canvas.graph?.getNodeOnPos(pos[0], pos[1])
          let targetProvider: ModelNodeProvider | null = null
          let targetGraphNode: LGraphNode | null = null
          if (nodeAtPos) {
            const providers = modelToNodeStore.getAllNodeProviders(
              model.directory
            )
            for (const provider of providers) {
              if (provider.nodeDef.name === nodeAtPos.comfyClass) {
                targetGraphNode = nodeAtPos
                targetProvider = provider
              }
            }
          }
          if (!targetGraphNode) {
            const provider = modelToNodeStore.getNodeProvider(model.directory)
            if (provider) {
              targetGraphNode = litegraphService.addNodeOnGraph(
                provider.nodeDef,
                {
                  pos
                }
              )
              targetProvider = provider
            }
          }
          if (targetGraphNode) {
            const widget = targetGraphNode.widgets?.find(
              (widget) => widget.name === targetProvider?.key
            )
            if (widget) {
              widget.value = model.file_name
            }
          }
        } else if (node.data instanceof ComfyWorkflow) {
          const workflow = node.data
          await workflowService.insertWorkflow(workflow, { position: basePos })
        }
      }
    }
  })
}
