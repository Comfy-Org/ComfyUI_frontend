import type { Direction, IBoundaryNodes } from "../interfaces"
import type { LGraphNode } from "../LGraphNode"

/**
 * Finds the nodes that are farthest in all four directions, representing the boundary of the nodes.
 * @param nodes The nodes to check the edges of
 * @returns An object listing the furthest node (edge) in all four directions.
 * `null` if no nodes were supplied or the first node was falsy.
 */
export function getBoundaryNodes(nodes: LGraphNode[]): IBoundaryNodes | null {
  const valid = nodes?.find(x => x)
  if (!valid) return null

  let top = valid
  let right = valid
  let bottom = valid
  let left = valid

  for (const node of nodes) {
    if (!node) continue
    const [x, y] = node.pos
    const [width, height] = node.size

    if (y < top.pos[1]) top = node
    if (x + width > right.pos[0] + right.size[0]) right = node
    if (y + height > bottom.pos[1] + bottom.size[1]) bottom = node
    if (x < left.pos[0]) left = node
  }

  return {
    top,
    right,
    bottom,
    left,
  }
}

/**
 * Distributes nodes evenly along a horizontal or vertical plane.
 * @param nodes The nodes to distribute
 * @param horizontal If true, distributes along the horizontal plane.  Otherwise, the vertical plane.
 */
export function distributeNodes(nodes: LGraphNode[], horizontal?: boolean): void {
  const nodeCount = nodes?.length
  if (!(nodeCount > 1)) return

  const index = horizontal ? 0 : 1

  let total = 0
  let highest = -Infinity

  for (const node of nodes) {
    total += node.size[index]

    const high = node.pos[index] + node.size[index]
    if (high > highest) highest = high
  }
  const sorted = [...nodes].sort((a, b) => a.pos[index] - b.pos[index])
  const lowest = sorted[0].pos[index]

  const gap = (highest - lowest - total) / (nodeCount - 1)
  let startAt = lowest
  for (let i = 0; i < nodeCount; i++) {
    const node = sorted[i]
    node.pos[index] = startAt + gap * i
    startAt += node.size[index]
  }
}

/**
 * Aligns all nodes along the edge of a node.
 * @param nodes The nodes to align
 * @param direction The edge to align nodes on
 * @param align_to The node to align all other nodes to.  If undefined, the farthest node will be used.
 */
export function alignNodes(
  nodes: LGraphNode[],
  direction: Direction,
  align_to?: LGraphNode,
): void {
  if (!nodes) return

  const boundary = align_to === undefined
    ? getBoundaryNodes(nodes)
    : { top: align_to, right: align_to, bottom: align_to, left: align_to }

  if (boundary === null) return

  for (const node of nodes) {
    switch (direction) {
    case "right":
      node.pos[0] = boundary.right.pos[0] + boundary.right.size[0] - node.size[0]
      break
    case "left":
      node.pos[0] = boundary.left.pos[0]
      break
    case "top":
      node.pos[1] = boundary.top.pos[1]
      break
    case "bottom":
      node.pos[1] = boundary.bottom.pos[1] + boundary.bottom.size[1] - node.size[1]
      break
    }
  }
}
