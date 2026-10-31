import { readonly, ref, shallowReadonly, shallowRef } from 'vue'

import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

interface AutogrowGroupDropTarget {
  nodeId: NodeId
  groupName: string
}

interface AutogrowGroupDropRow extends AutogrowGroupDropTarget {
  dotClientPos: [number, number]
}

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
    dotClientPos: [rect.left + rect.width / 2, rect.top + rect.height / 2]
  }
}

export const autogrowIoInputDragType = shallowReadonly(ioInputDragType)
export const hoveredAutogrowGroup = readonly(hoveredGroup)
