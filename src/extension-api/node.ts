/**
 * NodeHandle — the per-node domain surface of the v2 extension API.
 *
 * A `NodeHandle` is the object an extension receives inside `nodeCreated(node)`
 * (see {@link defineNodeExtension}). It is NOT the raw `LGraphNode`, and it is
 * NOT acquired imperatively by id from a global — the framework delivers it,
 * pre-bound to one node, through the extension lifecycle (D3.3, P1).
 *
 * Writes go through the internal command/executor layer, not a user-facing
 * command. `setSize` speaks in domain terms (a `Size` tuple) and translates to
 * the layout store's `resizeNode` command with `LayoutSource.External`, so the
 * mutation is serializable / undoable / CRDT-ready exactly like every other
 * layout command — but the extension author never names a command string
 * (D3.4: "the domain handles ARE the command API").
 *
 * This is the sanctioned replacement for the legacy `node.size[1] = h` idiom
 * and the migration destination for the runtime `size` Proxy in PR #13867.
 */
import { watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'

import type { Size } from './types'

export interface NodeHandle {
  /** The id of the node this handle controls. */
  readonly id: NodeId
  /** The node's registered type (comfyClass), e.g. `'KSampler'`. */
  readonly type: string

  /** Read the node's current size as a `[width, height]` tuple. */
  getSize(): Size
  /**
   * Resize the node to an explicit size. Commits through the layout store
   * (the single source of truth) with `LayoutSource.External`, so the Vue node
   * reflows to the new height.
   */
  setSize(size: Size): void
  /**
   * Resize the node to fit its intrinsic content.
   *
   * TODO(stable-resize-api A2): not implemented — depends on the content-measure
   * path. Throws until the follow-up lands.
   */
  autosize(): void
  /**
   * Subscribe to this node's resize events.
   *
   * TODO(stable-resize-api A3): not implemented — depends on a public event
   * surface over the layout store. Throws until the follow-up lands.
   */
  on(event: 'resize', handler: (size: Size) => void): void
}

export function createNodeHandle(node: LGraphNode): NodeHandle {
  const id = node.id
  return {
    id,
    type: node.comfyClass ?? node.type ?? '',

    getSize(): Size {
      const layout = layoutStore.getNodeLayoutRef(id).value
      if (layout) return [layout.size.width, layout.size.height]
      return [node.size[0], node.size[1]]
    },

    setSize([width, height]: Size): void {
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      )
        return

      const applyResize = (): void => {
        const mutations = useLayoutMutations()
        // `currentSource` is shared store state that `resizeNode` reads
        // directly, so tag this one mutation as External and restore the prior
        // source afterwards — otherwise every later mutation on the same store
        // is mislabeled External. Mirrors the save/restore pattern in
        // layoutStore.batchUpdateNodeBounds.
        const previousSource = layoutStore.getCurrentSource()
        mutations.setSource(LayoutSource.External)
        try {
          mutations.resizeNode(id, { width, height })
        } finally {
          mutations.setSource(previousSource)
        }
      }

      const layoutRef = layoutStore.getNodeLayoutRef(id)
      if (layoutRef.value) {
        applyResize()
        return
      }

      // `nodeCreated` runs synchronously while the node is still being
      // constructed, before the node is registered in the layout store: during
      // graph load, layout creation is deferred to `onAfterGraphConfigured`.
      // `resizeNode` no-ops without a layout entry, so wait for the entry to
      // appear (seeded from the node's own size) and then apply the resize once
      // — still routed through the layout store command, so the Vue node reflows
      // to the requested height.
      const stop = watch(layoutRef, (layout) => {
        if (!layout) return
        stop()
        applyResize()
      })
    },

    autosize(): void {
      throw new Error(
        'NodeHandle.autosize() is not implemented yet (follow-up A2).'
      )
    },

    on(event: 'resize'): void {
      throw new Error(
        `NodeHandle.on('${event}') is not implemented yet (follow-up A3).`
      )
    }
  }
}
