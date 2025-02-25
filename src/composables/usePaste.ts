import { LiteGraph } from '@comfyorg/litegraph'
import type { LGraphNode } from '@comfyorg/litegraph'
import { useEventListener } from '@vueuse/core'

import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { isAudioNode, isImageNode, isVideoNode } from '@/utils/litegraphUtil'

/**
 * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
 */
export const usePaste = () => {
  const workspaceStore = useWorkspaceStore()
  const canvasStore = useCanvasStore()

  const pasteItemOnNode = (
    items: DataTransferItemList,
    node: LGraphNode | null
  ) => {
    if (!node) return

    const blob = items[0]?.getAsFile()
    if (!blob) return

    node.pasteFile?.(blob)
    node.pasteFiles?.(
      Array.from(items)
        .map((i) => i.getAsFile())
        .filter((f) => f !== null)
    )
  }

  useEventListener(document, 'paste', async (e) => {
    // ctrl+shift+v is used to paste nodes with connections
    // this is handled by litegraph
    if (workspaceStore.shiftDown) return

    const { canvas } = canvasStore
    if (!canvas) return

    const { graph } = canvas
    let data: DataTransfer | string | null = e.clipboardData
    if (!data) throw new Error('No clipboard data on clipboard event')

    const { items } = data

    const currentNode = canvas.current_node as LGraphNode
    const isNodeSelected = currentNode?.is_selected

    const isImageNodeSelected = isNodeSelected && isImageNode(currentNode)
    const isVideoNodeSelected = isNodeSelected && isVideoNode(currentNode)
    const isAudioNodeSelected = isNodeSelected && isAudioNode(currentNode)

    let imageNode: LGraphNode | null = isImageNodeSelected ? currentNode : null
    let audioNode: LGraphNode | null = isAudioNodeSelected ? currentNode : null
    const videoNode: LGraphNode | null = isVideoNodeSelected
      ? currentNode
      : null

    // Look for image paste data
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        if (!imageNode) {
          // No image node selected: add a new one
          const newNode = LiteGraph.createNode('LoadImage')
          newNode.pos = [canvas.graph_mouse[0], canvas.graph_mouse[1]]
          if (newNode) imageNode = graph?.add(newNode) ?? null
          graph?.change()
        }
        pasteItemOnNode(items, imageNode)
        return
      } else if (item.type.startsWith('video/')) {
        if (!videoNode) {
          // No video node selected: add a new one
          // TODO: when video node exists
        } else {
          pasteItemOnNode(items, videoNode)
          return
        }
      } else if (item.type.startsWith('audio/')) {
        if (!audioNode) {
          // No audio node selected: add a new one
          const newNode = LiteGraph.createNode('LoadAudio')
          newNode.pos = [canvas.graph_mouse[0], canvas.graph_mouse[1]]
          if (newNode) audioNode = graph?.add(newNode) ?? null
          graph?.change()
        }
        pasteItemOnNode(items, audioNode)
        return
      }
    }

    // No image found. Look for node data
    data = data.getData('text/plain')
    let workflow: ComfyWorkflowJSON | null = null
    try {
      data = data.slice(data.indexOf('{'))
      workflow = JSON.parse(data)
    } catch (err) {
      try {
        data = data.slice(data.indexOf('workflow\n'))
        data = data.slice(data.indexOf('{'))
        workflow = JSON.parse(data)
      } catch (error) {
        workflow = null
      }
    }

    if (workflow && workflow.version && workflow.nodes && workflow.extra) {
      await app.loadGraphData(workflow)
    } else {
      if (
        (e.target instanceof HTMLTextAreaElement &&
          e.target.type === 'textarea') ||
        (e.target instanceof HTMLInputElement && e.target.type === 'text')
      ) {
        return
      }

      // Litegraph default paste
      canvas.pasteFromClipboard()
    }
  })
}
