import type { InjectionKey } from 'vue'

import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { containsCentre, containsRect } from '@/lib/litegraph/src/measure'

/** Provides the group a node is listed under in the panel, or null. */
export const GetNodeParentGroupKey: InjectionKey<
  (node: LGraphNode) => LGraphGroup | null
> = Symbol('getNodeParentGroup')

/** The innermost, then smallest, group whose bounds contain the node's centre. */
export function findParentGroup(
  groups: readonly LGraphGroup[],
  node: LGraphNode
): LGraphGroup | null {
  let parent: LGraphGroup | null = null

  for (const group of groups) {
    const groupRect = group.boundingRect
    if (!containsCentre(groupRect, node.boundingRect)) continue

    if (!parent) {
      parent = group
      continue
    }

    const parentRect = parent.boundingRect
    const candidateInsideParent = containsRect(parentRect, groupRect)
    const parentInsideCandidate = containsRect(groupRect, parentRect)

    if (candidateInsideParent && !parentInsideCandidate) {
      parent = group
      continue
    }

    const candidateArea = groupRect[2] * groupRect[3]
    const parentArea = parentRect[2] * parentRect[3]

    if (candidateArea < parentArea) parent = group
  }

  return parent
}
