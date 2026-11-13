import type {
  NodeHandleMembers,
  NodeHandles
} from '@/platform/nodeApi/v4/nodeHandle'
import type { NodePatch } from '@/platform/nodeApi/v4/types'
import { checkedString } from './checkedArguments'
import type { EditCore } from './edits'
import { attachBadge, checkedBadge } from './nodeBadges'
import { snapshotOf } from './nodeSnapshot'

/** A node handle's edit methods, each a call to `comfy.edit`, and its reads of them. */
export function nodeHandleMembers(
  handle: object,
  edits: EditCore,
  nodes: NodeHandles
): NodeHandleMembers {
  const update = (patch: NodePatch) => edits.updateNode(handle, patch)
  const live = () => nodes.locator(handle)?.()?.node

  return {
    setTitle: (title) => update({ title }),
    setMode: (mode) => update({ mode }),
    setCollapsed: (collapsed) => update({ collapsed }),
    setColor: (color) => update({ color }),
    setBgColor: (bgColor) => update({ bgColor }),
    setShape: (shape) => update({ shape }),
    setProperty: (name, value) =>
      update({
        properties: { [checkedString('setProperty', 'name', name)]: value }
      }),
    setSerializeWidgets: (serializeWidgets) => update({ serializeWidgets }),
    setPosition: (position) => update({ position }),
    setSize: (size) => update({ size }),
    setSizeConstraints: (sizeConstraints) => update({ sizeConstraints }),
    setResizable: (resizable) => update({ resizable }),
    remove: () => edits.removeNode(handle),

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
