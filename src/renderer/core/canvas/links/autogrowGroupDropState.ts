import { readonly, ref, shallowReadonly, shallowRef } from 'vue'

import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

/**
 * Autogrow group drop state
 *
 * An autogrow group is promoted to a subgraph input as a whole, so while a link
 * is dragged from a subgraph input node, each group's hidden widget the link can
 * connect to is revealed as a drop row. The canvas owns that drag, so it drives
 * this state and the Vue widget grid only renders it.
 */

interface AutogrowGroupDropTarget {
  nodeId: NodeId
  groupName: string
}

interface AutogrowGroupDropRow extends AutogrowGroupDropTarget {
  /** Client position of the row's connection dot. */
  clientPos: [number, number]
}

/** Type of the link dragged from a subgraph input node, if any. */
const ioInputDragType = ref<ISlotType>()
const hoveredGroup = shallowRef<AutogrowGroupDropTarget | null>(null)

export function setHoveredAutogrowGroup(
  target: AutogrowGroupDropTarget | null
) {
  const current = hoveredGroup.value
  if (
    current?.nodeId === target?.nodeId &&
    current?.groupName === target?.groupName
  )
    return
  hoveredGroup.value = target
}

export function setIoInputDragType(type: ISlotType | undefined) {
  ioInputDragType.value = type
  if (type === undefined) setHoveredAutogrowGroup(null)
}

/** The revealed autogrow drop row under a client point, if any. */
export function findAutogrowGroupDropRow(
  clientX: number,
  clientY: number
): AutogrowGroupDropRow | null {
  if (ioInputDragType.value === undefined) return null
  const row = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-autogrow-group]')
  const groupName = row?.dataset['autogrowGroup']
  const nodeIdAttr =
    row?.closest<HTMLElement>('[data-node-id]')?.dataset['nodeId']
  if (!row || !groupName || !nodeIdAttr) return null

  const dot = row.querySelector('.slot-dot') ?? row
  const rect = dot.getBoundingClientRect()
  return {
    nodeId: toNodeId(nodeIdAttr),
    groupName,
    clientPos: [rect.left + rect.width / 2, rect.top + rect.height / 2]
  }
}

export const autogrowIoInputDragType = shallowReadonly(ioInputDragType)
export const hoveredAutogrowGroup = readonly(hoveredGroup)
