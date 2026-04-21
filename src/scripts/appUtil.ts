import _ from 'es-toolkit/compat'

import type { Rect } from '@/lib/litegraph/src/interfaces'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Strips dangerous HTML entity characters from node names.
 */
export function sanitizeNodeName(string: string) {
  let entityMap = {
    '&': '',
    '<': '',
    '>': '',
    '"': '',
    "'": '',
    '`': '',
    '=': ''
  }
  return String(string).replace(/[&<>"'`=]/g, function fromEntityMap(s) {
    return entityMap[s as keyof typeof entityMap]
  })
}

/**
 * Checks whether the given data conforms to the ComfyUI API workflow format.
 * Each top-level value must have a string `class_type` and an object `inputs`.
 *
 * @deprecated
 */
export function isApiJson(data: unknown): data is ComfyApiWorkflow {
  if (!_.isObject(data) || Array.isArray(data)) {
    return false
  }
  if (Object.keys(data).length === 0) return false

  return Object.values(data).every((node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return false
    }

    const { class_type: classType, inputs } = node as Record<string, unknown>
    const inputsIsRecord = _.isObject(inputs) && !Array.isArray(inputs)
    return typeof classType === 'string' && inputsIsRecord
  })
}

/**
 * Vertically stacks nodes below the first node's position.
 * Returns `true` if any positions were changed.
 */
export function stackNodesVertically(
  nodes: { pos: [number, number]; getBounding: () => Rect }[]
): boolean {
  if (nodes.length <= 1) return false

  const [x, y] = nodes[0].getBounding()
  const nodeHeight = 150

  nodes.forEach((node, index) => {
    if (index > 0) {
      node.pos = [x, y + nodeHeight * index + 25 * (index + 1)]
    }
  })

  return true
}

/**
 * Positions image nodes vertically and places a batch node to their right.
 */
export function positionBatchLayout(
  nodes: {
    pos: [number, number]
    type: string
    getBounding: () => Rect
  }[],
  batchNode: { pos: [number, number] }
): void {
  const [x, y, width] = nodes[0].getBounding()
  batchNode.pos = [x + width + 100, y + 30]

  // Retrieving Node Height is inconsistent
  let height = 0
  if (nodes[0].type === 'LoadImage') {
    height = 344
  }

  nodes.forEach((node, index) => {
    if (index > 0) {
      node.pos = [x, y + height * index + 25 * (index + 1)]
    }
  })
}
