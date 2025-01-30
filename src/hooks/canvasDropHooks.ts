import { LGraphNode } from '@comfyorg/litegraph'
import { Ref } from 'vue'

import { usePragmaticDroppable } from '@/hooks/dndHooks'
import { app as comfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { ComfyModelDef } from '@/stores/modelStore'
import { ModelNodeProvider } from '@/stores/modelToNodeStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

export const useCanvasDrop = (canvasRef: Ref<HTMLCanvasElement>) => {
  const modelToNodeStore = useModelToNodeStore()
  const litegraphService = useLitegraphService()

  usePragmaticDroppable(() => canvasRef.value, {
    getDropEffect: (args): Exclude<DataTransfer['dropEffect'], 'none'> =>
      args.source.data.type === 'tree-explorer-node' ? 'copy' : 'move',
    onDrop: (event) => {
      const loc = event.location.current.input
      const dndData = event.source.data

      if (dndData.type === 'tree-explorer-node') {
        const node = dndData.data as RenderedTreeExplorerNode
        if (node.data instanceof ComfyNodeDefImpl) {
          const nodeDef = node.data
          // Add an offset on x to make sure after adding the node, the cursor
          // is on the node (top left corner)
          const pos = comfyApp.clientPosToCanvasPos([
            loc.clientX - 20,
            loc.clientY
          ])
          litegraphService.addNodeOnGraph(nodeDef, { pos })
        } else if (node.data instanceof ComfyModelDef) {
          const model = node.data
          const pos = comfyApp.clientPosToCanvasPos([loc.clientX, loc.clientY])
          const nodeAtPos = comfyApp.graph.getNodeOnPos(pos[0], pos[1])
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
        }
      }
    }
  })
}
