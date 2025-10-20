import { useEventListener } from '@vueuse/core'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isAudioNode, isImageNode, isVideoNode } from '@/utils/litegraphUtil'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

function pasteClipboardItems(data: DataTransfer): boolean {
  const rawData = data.getData('text/html')
  const match = rawData.match(/data-metadata="([A-Za-z0-9+/=]+)"/)?.[1]
  if (!match) return false
  try {
    useCanvasStore()
      .getCanvas()
      ._deserializeItems(JSON.parse(atob(match)), {})
    return true
  } catch (err) {
    console.error(err)
  }
  return false
}

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
    if (shouldIgnoreCopyPaste(e.target)) {
      // Default system copy
      return
    }
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
    if (pasteClipboardItems(data)) return

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
