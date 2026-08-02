import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createNode } from '@/utils/litegraphUtil'

import { pasteAudioNodes, pasteImageNodes, pasteVideoNodes } from './usePaste'

/**
 * Lowest y coordinate a new node must start below to clear every node
 * already placed in this drop batch.
 */
function clearanceBelow(precedingNodes: LGraphNode[]): number {
  if (precedingNodes.length === 0) return -Infinity

  const lowestPoint = Math.max(
    ...precedingNodes.map((node) => node.pos[1] + node.size[1])
  )
  return lowestPoint + 25
}

/**
 * Positions batched nodes in drag and drop
 * @param canvas The canvas the nodes belong to
 * @param nodes Nodes to position relative to `nodes[0]`'s current spot
 * @param precedingNodes Nodes already placed earlier in the same drop
 * batch (of any type) that `nodes` must not overlap
 */
export function positionNodes(
  canvas: LGraphCanvas,
  nodes: LGraphNode[],
  precedingNodes: LGraphNode[] = []
): void {
  if (nodes.length === 0) return
  if (nodes.length <= 1 && precedingNodes.length === 0) return

  const [x, boundY] = nodes[0].getBounding()
  const y = Math.max(boundY, clearanceBelow(precedingNodes))
  const nodeHeight = 150

  nodes.forEach((node, index) => {
    if (index > 0 || y !== boundY) {
      node.pos = [x, y + nodeHeight * index + 25 * (index + 1)]
    }
  })

  canvas.graph?.change()
}

export function positionBatchNodes(
  canvas: LGraphCanvas,
  nodes: LGraphNode[],
  batchNode: LGraphNode,
  precedingNodes: LGraphNode[] = []
): void {
  const [x, boundY, width] = nodes[0].getBounding()
  const y = Math.max(boundY, clearanceBelow(precedingNodes))
  batchNode.pos = [x + width + 100, y + 30]

  // Retrieving Node Height is inconsistent
  let height = 0
  if (nodes[0].type === 'LoadImage') {
    height = 344
  }

  nodes.forEach((node, index) => {
    if (index > 0 || y !== boundY) {
      node.pos = [x, y + height * index + 25 * (index + 1)]
    }
  })

  canvas.graph?.change()
}

/**
 * Loads multiple files, connects to a batch node, and selects them
 * @param canvas The canvas to create nodes on
 * @param fileList The files to load
 * @param precedingNodes Nodes already placed earlier in the same drop
 * batch (of any type) that the new nodes must not overlap
 */
export async function handleFileList(
  canvas: LGraphCanvas,
  fileList: File[],
  precedingNodes: LGraphNode[] = []
): Promise<LGraphNode[]> {
  if (fileList.length === 0) return []
  if (!fileList[0].type.startsWith('image')) return []

  const imageNodes = await pasteImageNodes(canvas, fileList)
  if (imageNodes.length === 0) return []

  if (imageNodes.length > 1) {
    const batchImagesNode = await createNode(canvas, 'BatchImagesNode')
    if (!batchImagesNode) return []

    positionBatchNodes(canvas, imageNodes, batchImagesNode, precedingNodes)
    canvas.selectItems([...imageNodes, batchImagesNode])

    imageNodes.forEach((imageNode, index) => {
      imageNode.connect(0, batchImagesNode, index)
    })
    return [...imageNodes, batchImagesNode]
  }

  if (precedingNodes.length > 0) {
    positionNodes(canvas, imageNodes, precedingNodes)
  }
  canvas.selectItems(imageNodes)
  return imageNodes
}

export async function handleAudioFileList(
  canvas: LGraphCanvas,
  fileList: File[],
  precedingNodes: LGraphNode[] = []
): Promise<LGraphNode[]> {
  const audioNodes = await pasteAudioNodes(canvas, fileList)
  if (audioNodes.length === 0) return []

  positionNodes(canvas, audioNodes, precedingNodes)
  canvas.selectItems(audioNodes)
  return audioNodes
}

export async function handleVideoFileList(
  canvas: LGraphCanvas,
  fileList: File[],
  precedingNodes: LGraphNode[] = []
): Promise<LGraphNode[]> {
  const videoNodes = await pasteVideoNodes(canvas, fileList)
  if (videoNodes.length === 0) return []

  positionNodes(canvas, videoNodes, precedingNodes)
  canvas.selectItems(videoNodes)
  return videoNodes
}
