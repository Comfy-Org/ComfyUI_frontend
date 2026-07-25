import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'
import type { NodeId } from '@/types/nodeId'

/** Remove geometry only for slots that no longer exist in the node model. */
export function reconcileTrackedNodeSlots(
  nodeId: NodeId,
  inputCount: number,
  outputCount: number
) {
  const registryStore = useNodeSlotRegistryStore()
  const node = registryStore.getNode(nodeId)
  if (!node) return

  for (const [slotKey, entry] of node.slots) {
    const count = entry.type === 'input' ? inputCount : outputCount
    if (entry.index < count) continue

    if (entry.el) delete entry.el.dataset.slotKey
    node.slots.delete(slotKey)
    layoutStore.deleteSlotLayout(slotKey)
  }
}

/** Clear retained slot geometry when its owning node is actually deleted. */
export function deleteTrackedNodeSlots(nodeId: NodeId) {
  const registryStore = useNodeSlotRegistryStore()
  const node = registryStore.getNode(nodeId)
  if (!node) return

  node.stopWatch?.()
  for (const [slotKey, entry] of node.slots) {
    if (entry.el) delete entry.el.dataset.slotKey
    layoutStore.deleteSlotLayout(slotKey)
  }
  registryStore.deleteNode(nodeId)
}

/** Clear all retained geometry when the active graph or renderer changes. */
export function clearTrackedSlotLayouts() {
  const registryStore = useNodeSlotRegistryStore()
  for (const nodeId of registryStore.getNodeIds()) {
    deleteTrackedNodeSlots(nodeId)
  }
  layoutStore.clearAllSlotLayouts()
}
