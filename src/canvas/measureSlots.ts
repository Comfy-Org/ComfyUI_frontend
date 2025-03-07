import type { Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"

import { isInRectangle } from "@/measure"

/**
 * returns the INDEX if a position (in graph space) is on top of a node input slot
 */
export function isOverNodeInput(
  node: LGraphNode,
  canvasx: number,
  canvasy: number,
  slot_pos?: Point,
): number {
  const { inputs } = node
  if (inputs) {
    for (const [i, input] of inputs.entries()) {
      const link_pos = node.getConnectionPos(true, i)
      let is_inside = false
      // TODO: Find a cheap way to measure text, and do it on node label change instead of here
      // Input icon width + text approximation
      const width =
        20 + ((input.label?.length ?? input.localized_name?.length ?? input.name?.length) || 3) * 7
      is_inside = isInRectangle(
        canvasx,
        canvasy,
        link_pos[0] - 10,
        link_pos[1] - 10,
        width,
        20,
      )
      if (is_inside) {
        if (slot_pos) {
          slot_pos[0] = link_pos[0]
          slot_pos[1] = link_pos[1]
        }
        return i
      }
    }
  }
  return -1
}

/**
 * returns the INDEX if a position (in graph space) is on top of a node output slot
 */
export function isOverNodeOutput(
  node: LGraphNode,
  canvasx: number,
  canvasy: number,
  slot_pos?: Point,
): number {
  const { outputs } = node
  if (outputs) {
    for (let i = 0; i < outputs.length; ++i) {
      const link_pos = node.getConnectionPos(false, i)
      const is_inside = isInRectangle(
        canvasx,
        canvasy,
        link_pos[0] - 10,
        link_pos[1] - 10,
        40,
        20,
      )
      if (is_inside) {
        if (slot_pos) {
          slot_pos[0] = link_pos[0]
          slot_pos[1] = link_pos[1]
        }
        return i
      }
    }
  }
  return -1
}
