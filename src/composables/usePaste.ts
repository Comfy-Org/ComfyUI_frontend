import { LiteGraph } from '@comfyorg/litegraph'
import type { LGraphNode } from '@comfyorg/litegraph'
import { useEventListener } from '@vueuse/core'

import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isAudioNode, isImageNode, isVideoNode } from '@/utils/litegraphUtil'

/**
 * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
 */
export const usePaste = () => {
  const workspaceStore = useWorkspaceStore()
  const canvasStore = useCanvasStore()

  const pasteItemsOnNode = (
    items: DataTransferItemList,
    node: LGraphNode | null,
    contentType: string
  ) => {
    if (!node) return

    const filteredItems = Array.from(items).filter((item) =>
      item.type.startsWith(contentType)
    )

    const blob = filteredItems[0]?.getAsFile()
    if (!blob) return

    node.pasteFile?.(blob)
    node.pasteFiles?.(
      Array.from(filteredItems)
        .map((i) => i.getAsFile())
        .filter((f) => f !== null)
    )
  }

  useEventListener(document, 'paste', async (e) => {
    const isTargetInGraph =
      e.target instanceof Element &&
      (e.target.classList.contains('litegraph') ||
        e.target.classList.contains('graph-canvas-container') ||
        e.target.id === 'graph-canvas')

    // If the target is not in the graph, we don't want to handle the paste event
    if (!isTargetInGraph) return

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
          if (newNode) {
            newNode.pos = [canvas.graph_mouse[0], canvas.graph_mouse[1]]
            imageNode = graph?.add(newNode) ?? null
          }
          graph?.change()
        }
        pasteItemsOnNode(items, imageNode, 'image')
        return
      } else if (item.type.startsWith('video/')) {
        if (!videoNode) {
          // No video node selected: add a new one
          // TODO: when video node exists
        } else {
          pasteItemsOnNode(items, videoNode, 'video')
          return
        }
      } else if (item.type.startsWith('audio/')) {
        if (!audioNode) {
          // No audio node selected: add a new one
          const newNode = LiteGraph.createNode('LoadAudio')
          if (newNode) {
            newNode.pos = [canvas.graph_mouse[0], canvas.graph_mouse[1]]
            audioNode = graph?.add(newNode) ?? null
          }
          graph?.change()
        }
        pasteItemsOnNode(items, audioNode, 'audio')
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
