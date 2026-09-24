import { useEventListener } from '@vueuse/core'
import { z } from 'zod'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ClipboardItems } from '@/lib/litegraph/src/types/serialisation'
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

const zClipboardNodeId = z.union([z.number(), z.string()])
const zClipboardPos = z.array(z.number()).min(2)

const zClipboardNode = z
  .object({
    id: zClipboardNodeId,
    type: z.string(),
    pos: zClipboardPos
  })
  .passthrough()

const zClipboardGroup = z
  .object({
    bounding: z.array(z.number()).min(4)
  })
  .passthrough()

const zClipboardReroute = z
  .object({
    id: z.number(),
    pos: zClipboardPos
  })
  .passthrough()

const zClipboardLink = z
  .object({
    id: z.number(),
    origin_id: zClipboardNodeId,
    target_id: zClipboardNodeId
  })
  .passthrough()

const zClipboardSubgraph = z.object({ id: z.string() }).passthrough()

/**
 * The subset of `ClipboardItems`' shape `_deserializeItems` actually
 * dereferences (`item.pos[0]`, `group.bounding[0]`, node/link ids). Rejects a
 * decoded `data-metadata` payload that merely happens to be valid JSON —
 * copied from a third-party page whose HTML coincidentally matches the
 * base64-ish attribute pattern — as well as a well-formed but empty object,
 * which carries none of the five keys below.
 */
const zClipboardItems = z
  .object({
    nodes: z.array(zClipboardNode).optional(),
    groups: z.array(zClipboardGroup).optional(),
    reroutes: z.array(zClipboardReroute).optional(),
    links: z.array(zClipboardLink).optional(),
    subgraphs: z.array(zClipboardSubgraph).optional()
  })
  .passthrough()
  .refine(
    (value) =>
      Array.isArray(value.nodes) ||
      Array.isArray(value.groups) ||
      Array.isArray(value.reroutes) ||
      Array.isArray(value.links) ||
      Array.isArray(value.subgraphs)
  )

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

  let decoded: unknown
  try {
    // Decode UTF-8 safe base64
    const binaryString = atob(match)
    const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0))
    const decodedData = new TextDecoder().decode(bytes)
    decoded = JSON.parse(decodedData)
  } catch (err) {
    // Not a valid metadata payload — other paste strategies may still apply.
    console.error(err)
    return false
  }

  if (!zClipboardItems.safeParse(decoded).success) return false
  const parsed = decoded as ClipboardItems

  // A real deserialization/graph-mutation failure (e.g. node ID space
  // exhaustion) is a genuine paste error, not "no valid metadata payload" —
  // it must not fall through to the other paste strategies below.
  try {
    useCanvasStore().getCanvas()._deserializeItems(parsed, {})
  } catch (err) {
    useErrorHandling().toastErrorHandler(err)
  }
  return true
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

    // No image found. Look for node data
    data = data.getData('text/plain')
    let workflow: unknown
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
      canvas.pasteFromClipboard()
    }
  })
}
