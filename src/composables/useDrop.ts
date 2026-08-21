import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createNode } from '@/utils/litegraphUtil'

import { pasteAudioNodes, pasteImageNodes, pasteVideoNodes } from './usePaste'

/**
 * Some node types grow after they are created (e.g. LoadImage gains its
 * preview image once the backend responds), so their live `size[1]` at
 * positioning time under-reports the height the node will actually occupy
 * once it settles. clearanceBelow and positionBatchNodes must agree on how
 * tall a node "really" is, or one of them will under-reserve space and the
 * next node in the batch will land inside it.
 *
 * This is the single height authority both functions read through. Known
 * node types use a documented, conservative (>= true settled height)
 * constant; everything else falls back to the node's live `size[1]`.
 */
const KNOWN_SETTLED_NODE_HEIGHTS: Partial<Record<string, number>> = {
  LoadImage: 344
}

function getStackingHeight(node: LGraphNode): number {
  return KNOWN_SETTLED_NODE_HEIGHTS[node.type ?? ''] ?? node.size[1]
}

/**
 * Lowest y coordinate a new node must start below to clear every node
 * already placed in this drop batch.
 */
function clearanceBelow(precedingNodes: LGraphNode[]): number {
  if (precedingNodes.length === 0) return -Infinity

  const lowestPoint = Math.max(
    ...precedingNodes.map((node) => node.pos[1] + getStackingHeight(node))
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

  // Anchor on the node's own pos rather than its cached boundingRect:
  // getBounding() returns whatever updateArea() last wrote, which for a
  // freshly created, never-drawn node is still [0, 0, 0, 0]. clearanceBelow
  // already reads live pos/size, so anchoring here from pos keeps both
  // halves of this comparison in the same coordinate space.
  const [x, anchorY] = nodes[0].pos
  const clearance = clearanceBelow(precedingNodes)
  const pushedDown = clearance > anchorY
  const y = pushedDown ? clearance : anchorY
  const nodeHeight = 150

  nodes.forEach((node, index) => {
    if (index > 0 || pushedDown) {
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
  const [x, anchorY] = nodes[0].pos
  const width = nodes[0].size[0]
  const clearance = clearanceBelow(precedingNodes)
  const pushedDown = clearance > anchorY
  const y = pushedDown ? clearance : anchorY
  batchNode.pos = [x + width + 100, y + 30]

  const height = getStackingHeight(nodes[0])

  nodes.forEach((node, index) => {
    if (index > 0 || pushedDown) {
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
    if (!batchImagesNode) {
      // No BatchImagesNode registered (e.g. unsupported backend) - the image
      // nodes are already on the graph, so the caller still needs to know
      // about them to keep later batch members from overlapping.
      positionNodes(canvas, imageNodes, precedingNodes)
      canvas.selectItems(imageNodes)
      return imageNodes
    }

    positionBatchNodes(canvas, imageNodes, batchImagesNode, precedingNodes)
    canvas.selectItems([...imageNodes, batchImagesNode])

    imageNodes.forEach((imageNode, index) => {
      imageNode.connect(0, batchImagesNode, index)
    })
    return [...imageNodes, batchImagesNode]
  }

  positionNodes(canvas, imageNodes, precedingNodes)
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
