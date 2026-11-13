import type {
  NodeHandleMembers,
  NodeHandles
} from '@/platform/nodeApi/v4/nodeHandle'
import type { NodePatch } from '@/platform/nodeApi/v4/types'
import { checkedString } from './checkedArguments'
import type { EditCore } from './edits'
import type { SlotHandles } from './liveSlot'
import { attachBadge, checkedBadge } from './nodeBadges'
import { slotCollection } from './slotCollection'
import { snapshotOf } from './nodeSnapshot'

/** A node handle's edit methods, each a call to `comfy.edit`, and its reads of them. */
export function nodeHandleMembers(
  handle: object,
  edits: EditCore,
  nodes: NodeHandles,
  slots: SlotHandles
): NodeHandleMembers {
  const update = (member: string, patch: NodePatch) =>
    edits.updateNode(handle, patch, member)
  const live = () => nodes.locator(handle)?.()?.node

  return {
    setTitle: (title) => update('setTitle', { title }),
    setMode: (mode) => update('setMode', { mode }),
    setCollapsed: (collapsed) => update('setCollapsed', { collapsed }),
    setColor: (color) => update('setColor', { color }),
    setBgColor: (bgColor) => update('setBgColor', { bgColor }),
    setShape: (shape) => update('setShape', { shape }),
    setProperty: (name, value) =>
      update('setProperty', {
        properties: { [checkedString('setProperty', 'name', name)]: value }
      }),
    setSerializeWidgets: (serializeWidgets) =>
      update('setSerializeWidgets', { serializeWidgets }),
    setPosition: (position) => update('setPosition', { position }),
    setSize: (size) => update('setSize', { size }),
    setSizeConstraints: (sizeConstraints) =>
      update('setSizeConstraints', { sizeConstraints }),
    setResizable: (resizable) => update('setResizable', { resizable }),
    remove: () => edits.removeNode(handle),

    inputs: slotCollection(handle, nodes, {
      slotsOf: (node) => node.inputs,
      handleFor: slots.inputHandle,
      add: (name, type, options) =>
        edits.addInput(handle, name, type, options, 'add'),
      remove: (slot) => edits.removeSlot(slot, 'remove'),
      reorder: (names) => edits.reorderSlots(handle, 'input', names, 'reorder')
    }),
    outputs: slotCollection(handle, nodes, {
      slotsOf: (node) => node.outputs,
      handleFor: slots.outputHandle,
      add: (name, type, options) =>
        edits.addOutput(handle, name, type, options, 'add'),
      remove: (slot) => edits.removeSlot(slot, 'remove'),
      reorder: (names) => edits.reorderSlots(handle, 'output', names, 'reorder')
    }),

    isSerializingWidgets() {
      const node = live()
      return node && Boolean(node.serialize_widgets)
    },
    isResizable() {
      const node = live()
      return node && node.resizable !== false
    },
    snapshot() {
      const node = live()
      return node && snapshotOf(node)
    },
    addBadge(badge) {
      const entry = checkedBadge(badge)
      const node = live()
      return node ? attachBadge(node, entry) : () => {}
    }
  }
}
