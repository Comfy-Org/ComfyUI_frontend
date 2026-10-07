import { useEventListener } from '@vueuse/core'

import { parseClipboardHtml } from '@/composables/useCopy'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { CANVAS_CLIPBOARD_ID_KEY } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { zClipboardItems } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  createNode,
  isAudioNode,
  isImageNode,
  isSelectOnly,
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
  const parsed = parseClipboardHtml(data.getData('text/html'))
  if (parsed.status === 'absent') return false
  if (parsed.status === 'unreadable') {
    useErrorHandling().toastErrorHandler(parsed.cause)
    return true
  }

  const clipboardItems = zClipboardItems.safeParse(parsed.payload)
  if (!clipboardItems.success) {
    useErrorHandling().toastErrorHandler(clipboardItems.error)
    return true
  }

  try {
    useCanvasStore().getCanvas()._deserializeItems(clipboardItems.data, {})
  } catch (err) {
    useErrorHandling().toastErrorHandler(err)
  }
  return true
}

function holdsLatestCanvasCopy(html: string): boolean {
  const parsed = parseClipboardHtml(html)
  if (parsed.status !== 'read') return false
  const { payload } = parsed
  try {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'clipboardId' in payload &&
      typeof payload.clipboardId === 'string' &&
      payload.clipboardId === localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
    )
  } catch {
    return false
  }
}

function isWorkflow(
  value: unknown
): value is Parameters<typeof app.loadGraphData>[0] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    (typeof value.version === 'number' || typeof value.version === 'string') &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'extra' in value &&
    typeof value.extra === 'object' &&
    value.extra !== null &&
    !Array.isArray(value.extra)
  )
}

function pasteItemsOnNode(
  items: DataTransferItemList,
  node: LGraphNode | null,
  contentType: string
): void {
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

export async function pasteImageNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  imageNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  // No image node selected: add a new one
  if (!imageNode) {
    imageNode = await createNode(canvas, 'LoadImage')
  }

  pasteItemsOnNode(items, imageNode, 'image')
  return imageNode
}

export async function pasteImageNodes(
  canvas: LGraphCanvas,
  fileList: File[]
): Promise<LGraphNode[]> {
  const nodes: LGraphNode[] = []

  for (const file of fileList) {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const imageNode = await pasteImageNode(canvas, transfer.items)

    if (imageNode) {
      nodes.push(imageNode)
    }
  }

  return nodes
}

export async function pasteAudioNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  audioNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  if (!audioNode) {
    audioNode = await createNode(canvas, 'LoadAudio')
  }
  pasteItemsOnNode(items, audioNode, 'audio')
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
  pasteItemsOnNode(items, videoNode, 'video')
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

/**
 * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
 */
export const usePaste = () => {
  const workspaceStore = useWorkspaceStore()
  const canvasStore = useCanvasStore()

  useEventListener(document, 'paste', async (e) => {
    // An editor claims the paste it handles by cancelling it. Its target is not
    // always editable: a caret inside an uneditable chip makes the chip the
    // target, which shouldIgnoreCopyPaste would hand to the canvas.
    if (e.defaultPrevented) return
    if (shouldIgnoreCopyPaste(e.target)) {
      // Default system copy
      return
    }
    // ctrl+shift+v is used to paste nodes with connections
    // this is handled by litegraph
    if (workspaceStore.shiftDown) return

    const { canvas } = canvasStore
    if (!canvas || isSelectOnly(canvas)) return

    let data: DataTransfer | string | null = e.clipboardData
    if (!data) {
      console.error('No clipboard data on clipboard event')
      return
    }
    data = cloneDataTransfer(data)

    const { items } = data

    const currentNode = canvas.current_node
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

    // Look for image paste data
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        await pasteImageNode(canvas, items, imageNode)
        return
      } else if (item.type.startsWith('video/')) {
        await pasteVideoNode(canvas, items, videoNode)
        return
      } else if (item.type.startsWith('audio/')) {
        await pasteAudioNode(canvas, items, audioNode)
        return
      }
    }

    const isMediaNodeSelected =
      isImageNodeSelected || isVideoNodeSelected || isAudioNodeSelected
    if (!isMediaNodeSelected && pasteClipboardItems(data)) return
    const html = data.getData('text/html')

    // No image found. Look for node data
    data = data.getData('text/plain')
    let workflow: unknown
    try {
      data = data.slice(data.indexOf('{'))
      workflow = JSON.parse(data)
    } catch {
      try {
        data = data.slice(data.indexOf('workflow\n'))
        data = data.slice(data.indexOf('{'))
        workflow = JSON.parse(data)
      } catch {
        workflow = null
      }
    }

    if (isWorkflow(workflow)) {
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
      if (!isMediaNodeSelected || holdsLatestCanvasCopy(html)) {
        canvas.pasteFromClipboard()
      } else {
        useToastStore().add({
          severity: 'info',
          summary: t('toastMessages.nothingToPasteIntoNode'),
          life: 3000
        })
      }
    }
  })
}
