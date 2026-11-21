import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createNode } from '@/utils/createNode'

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
    filteredItems
      .map((item) => item.getAsFile())
      .filter((file) => file !== null)
  )
}

export async function pasteImageNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  imageNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  const node = imageNode ?? (await createNode(canvas, 'LoadImage'))
  pasteItemsOnNode(items, node, 'image')
  return node
}

export async function pasteImageNodes(
  canvas: LGraphCanvas,
  fileList: File[]
): Promise<LGraphNode[]> {
  const nodes: LGraphNode[] = []
  for (const file of fileList) {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const node = await pasteImageNode(canvas, transfer.items)
    if (node) nodes.push(node)
  }
  return nodes
}

export async function pasteAudioNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  audioNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  const node = audioNode ?? (await createNode(canvas, 'LoadAudio'))
  pasteItemsOnNode(items, node, 'audio')
  return node
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
    if (node) nodes.push(node)
  }
  return nodes
}

export async function pasteVideoNode(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  videoNode: LGraphNode | null = null
): Promise<LGraphNode | null> {
  const node = videoNode ?? (await createNode(canvas, 'LoadVideo'))
  pasteItemsOnNode(items, node, 'video')
  return node
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
    if (node) nodes.push(node)
  }
  return nodes
}
