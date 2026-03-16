import { useEventListener } from '@vueuse/core'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  createNode,
  isAudioNode,
  isImageNode,
  isVideoNode
} from '@/utils/litegraphUtil'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

export function cloneDataTransfer(original: DataTransfer): DataTransfer {
  const persistent = new DataTransfer()

  // Copy string data
  for (const type of original.types) {
    const data = original.getData(type)
    if (data) {
      persistent.setData(type, data)
    }
  }

  for (const item of original.items) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        persistent.items.add(file)
      }
    }
  }

  // Preserve dropEffect and effectAllowed
  persistent.dropEffect = original.dropEffect
  persistent.effectAllowed = original.effectAllowed

  return persistent
}

function pasteClipboardItems(data: DataTransfer): boolean {
  const rawData = data.getData('text/html')
  const match = rawData.match(/data-metadata="([A-Za-z0-9+/=]+)"/)?.[1]
  if (!match) return false
  try {
    // Decode UTF-8 safe base64
    const binaryString = atob(match)
    const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0))
    const decodedData = new TextDecoder().decode(bytes)
    useCanvasStore().getCanvas()._deserializeItems(JSON.parse(decodedData), {})
    return true
  } catch (err) {
    console.error(err)
  }
  return false
}

async function pasteItemsOnNode(
  items: DataTransferItemList,
  node: LGraphNode | null,
  contentType: string
): Promise<void> {
  if (!node) return

  const filteredItems = Array.from(items).filter((item) =>
    item.type.startsWith(contentType)
  )

  const blob = filteredItems[0]?.getAsFile()
  if (!blob) return

  node.pasteFile?.(blob)
  await Promise.resolve(
    node.pasteFiles?.(
      Array.from(filteredItems)
        .map((i) => i.getAsFile())
        .filter((f) => f !== null)
    )
  )
}

export async function pasteImageNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  imageNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  // No image node selected: add a new one
  if (!imageNode) {
    imageNode = await createNode(canvas, 'LoadImage')
  }

  await pasteItemsOnNode(items, imageNode, 'image')
  return imageNode
}

interface PasteNodesResult {
  nodes: LGraphNode[]
  completion: Promise<void>
}

export async function pasteImageNodes(
  canvas: LGraphCanvas,
  fileList: File[]
): Promise<PasteNodesResult> {
  const nodes: LGraphNode[] = []
  const uploads: Promise<void>[] = []

  for (const file of fileList) {
    const node = await createNode(canvas, 'LoadImage')
    if (!node) continue

    nodes.push(node)

    const transfer = new DataTransfer()
    transfer.items.add(file)
    uploads.push(pasteItemsOnNode(transfer.items, node, 'image'))
  }

  return {
    nodes,
    completion: Promise.all(uploads).then(() => {})
  }
}

export async function pasteAudioNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  audioNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  if (!audioNode) {
    audioNode = await createNode(canvas, 'LoadAudio')
  }
  await pasteItemsOnNode(items, audioNode, 'audio')
  return audioNode
}

export async function pasteAudioNodes(
  canvas: LGraphCanvas,
  fileList: File[]
): Promise<LGraphNode[]> {
  const nodes: LGraphNode[] = []

  for (const file of fileList) {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const node = await pasteAudioNode(canvas, transfer.items)

    if (node) {
      nodes.push(node)
    }
  }

  return nodes
}

export async function pasteVideoNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  videoNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  if (!videoNode) {
    videoNode = await createNode(canvas, 'LoadVideo')
  }
  await pasteItemsOnNode(items, videoNode, 'video')
  return videoNode
}

export async function pasteVideoNodes(
  canvas: LGraphCanvas,
  fileList: File[]
): Promise<LGraphNode[]> {
  const nodes: LGraphNode[] = []

  for (const file of fileList) {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const node = await pasteVideoNode(canvas, transfer.items)

    if (node) {
      nodes.push(node)
    }
  }

  return nodes
}

interface MediaFiles {
  images: File[]
  videos: File[]
  audios: File[]
}

export function collectMediaFiles(items: DataTransferItemList): MediaFiles {
  const result: MediaFiles = { images: [], videos: [], audios: [] }
  for (const item of items) {
    const file = item.getAsFile()
    if (!file) continue
    if (item.type.startsWith('image/')) result.images.push(file)
    else if (item.type.startsWith('video/')) result.videos.push(file)
    else if (item.type.startsWith('audio/')) result.audios.push(file)
  }
  return result
}

async function handleMediaPaste(
  canvas: LGraphCanvas,
  canvasStore: ReturnType<typeof useCanvasStore>,
  files: File[],
  selectedNode: LGraphNode | null,
  mediaType: 'image' | 'video' | 'audio'
): Promise<void> {
  if (selectedNode || files.length === 1) {
    const transfer = new DataTransfer()
    transfer.items.add(files[0])
    if (mediaType === 'image')
      await pasteImageNode(canvas, transfer.items, selectedNode)
    else if (mediaType === 'video')
      await pasteVideoNode(canvas, transfer.items, selectedNode)
    else await pasteAudioNode(canvas, transfer.items, selectedNode)
    return
  }

  const lgCanvas = canvasStore.getCanvas()
  lgCanvas.emitBeforeChange()
  try {
    if (mediaType === 'image') {
      const { nodes, completion } = await pasteImageNodes(canvas, files)
      if (nodes.length > 1) {
        const batchImagesNode = await createNode(canvas, 'BatchImagesNode')
        if (batchImagesNode) {
          app.positionBatchNodes(nodes, batchImagesNode)
          lgCanvas.selectItems([...nodes, batchImagesNode])
          nodes.forEach((imageNode, index) => {
            imageNode.connect(0, batchImagesNode, index)
          })
        }
      } else if (nodes.length > 0) {
        lgCanvas.selectItems(nodes)
      }
      await completion
    } else if (mediaType === 'video') {
      const nodes = await pasteVideoNodes(canvas, files)
      if (nodes.length > 0) {
        app.positionNodes(nodes)
        lgCanvas.selectItems(nodes)
      }
    } else {
      const nodes = await pasteAudioNodes(canvas, files)
      if (nodes.length > 0) {
        app.positionNodes(nodes)
        lgCanvas.selectItems(nodes)
      }
    }
  } finally {
    lgCanvas.emitAfterChange()
  }
}

/**
 * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
 */
export const usePaste = () => {
  const workspaceStore = useWorkspaceStore()
  const canvasStore = useCanvasStore()

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

    let data: DataTransfer | string | null = e.clipboardData
    if (!data) throw new Error('No clipboard data on clipboard event')
    data = cloneDataTransfer(data)

    const { items } = data

    const currentNode = canvas.current_node as LGraphNode
    const isNodeSelected = currentNode?.is_selected

    const isImageNodeSelected = isNodeSelected && isImageNode(currentNode)
    const isVideoNodeSelected = isNodeSelected && isVideoNode(currentNode)
    const isAudioNodeSelected = isNodeSelected && isAudioNode(currentNode)

    const audioNode: LGraphNode | null = isAudioNodeSelected
      ? currentNode
      : null
    const imageNode: LGraphNode | null = isImageNodeSelected
      ? currentNode
      : null
    const videoNode: LGraphNode | null = isVideoNodeSelected
      ? currentNode
      : null

    // Look for media paste data
    const mediaFiles = collectMediaFiles(items)

    if (mediaFiles.images.length > 0) {
      await handleMediaPaste(
        canvas as LGraphCanvas,
        canvasStore,
        mediaFiles.images,
        imageNode,
        'image'
      )
      return
    }
    if (mediaFiles.videos.length > 0) {
      await handleMediaPaste(
        canvas as LGraphCanvas,
        canvasStore,
        mediaFiles.videos,
        videoNode,
        'video'
      )
      return
    }
    if (mediaFiles.audios.length > 0) {
      await handleMediaPaste(
        canvas as LGraphCanvas,
        canvasStore,
        mediaFiles.audios,
        audioNode,
        'audio'
      )
      return
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
