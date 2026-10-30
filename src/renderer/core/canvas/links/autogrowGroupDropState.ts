import { readonly, ref, shallowRef } from 'vue'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

/**
 * Autogrow group drop state
 *
 * An autogrow group is promoted to a subgraph input as a whole, so while a link
 * is dragged from a subgraph input node, each group's hidden widget is revealed
 * as a drop row. The canvas owns that drag, so it drives this state and the Vue
 * widget grid only renders it.
 */

interface AutogrowGroupDropTarget {
  nodeId: NodeId
  groupName: string
}

interface AutogrowGroupDropRow extends AutogrowGroupDropTarget {
  /** Client position of the row's connection dot. */
  clientPos: [number, number]
  rowClientTop: number
}

const ioInputDragActive = ref(false)
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
  hoveredGroup.value = target && {
    nodeId: target.nodeId,
    groupName: target.groupName
  }
}

export function setIoInputDragActive(active: boolean) {
  ioInputDragActive.value = active
  if (!active) setHoveredAutogrowGroup(null)
}

/** The revealed autogrow drop row under a client point, if any. */
export function findAutogrowGroupDropRow(
  clientX: number,
  clientY: number
): AutogrowGroupDropRow | null {
  if (!ioInputDragActive.value) return null
  const row = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-autogrow-group]')
  const groupName = row?.dataset['autogrowGroup']
  const nodeIdAttr =
    row?.closest<HTMLElement>('[data-node-id]')?.dataset['nodeId']
  if (!row || !groupName || !nodeIdAttr) return null

  const dot = row.querySelector('[data-autogrow-group-dot]') ?? row
  const rect = dot.getBoundingClientRect()
  return {
    nodeId: toNodeId(nodeIdAttr),
    groupName,
    clientPos: [rect.left + rect.width / 2, rect.top + rect.height / 2],
    rowClientTop: row.getBoundingClientRect().top
  }
}

export function useAutogrowGroupDropState() {
  return {
    ioInputDragActive: readonly(ioInputDragActive),
    hoveredGroup: readonly(hoveredGroup)
  }
}
