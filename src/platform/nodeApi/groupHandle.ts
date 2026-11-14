/**
 * Groups: the rectangles a user draws around related nodes.
 *
 * Packs read `graph._groups` to build a muter, a runner, or a navigator — mute
 * everything in this group, queue only its output nodes, jump to it. All of
 * that needs the same three things: which groups exist, which nodes each
 * holds, and where it is.
 *
 * Membership is derived, not stored: a group holds whatever its rectangle
 * overlaps at the moment you ask. That is why `nodes()` is a method. A node
 * dragged out of a group leaves it, with nothing recorded anywhere.
 */
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

import type { HandleCommon } from './closedProxy'
import { ComfyDeletedError } from './errors'
import { followGraph } from './graphOwner'
import type { Bounds, NodeHandle } from './nodeHandle'

export interface GroupHandle extends HandleCommon {
  readonly id: string
  getTitle(): string
  setTitle(title: string): void
  /** Colour as the renderer holds it, or undefined for the default. */
  getColor(): string | undefined
  setColor(color: string): void
  /**
   * The nodes the group currently contains, recomputed on each call.
   *
   * Packs muted or queued "the group", which always meant its nodes. Do not
   * cache the result: a drag changes it with no event.
   */
  nodes(): readonly NodeHandle[]
  /** The group's rectangle in graph space, title bar included. */
  getBounds(): Bounds
  /** Pans the view so this group is in the middle of it. Zoom is unchanged. */
  centerOn(): void
}

export function createGroupHandles(
  handleForNode: (node: LGraphNode) => NodeHandle | undefined
) {
  const cache = new WeakMap<LGraphGroup, GroupHandle>()
  return function groupHandle(group: LGraphGroup): GroupHandle {
    const cached = cache.get(group)
    if (cached) return cached
    const id = String(group.id)
    const owner = group.graph ? followGraph(group.graph) : () => undefined
    const live = () =>
      owner()?._groups.find((candidate) => candidate.id === group.id)
    const writable = (property: string) => {
      const found = live()
      if (!found) throw new ComfyDeletedError('group', id, property)
      return found
    }

    const handle: GroupHandle = Object.freeze({
      id,
      get isDeleted() {
        return !live()
      },
      getTitle: () => live()?.title ?? '',
      setTitle: (title: string) => {
        writable('title').title = title
      },
      getColor: () => live()?.color,
      setColor: (color: string) => {
        writable('color').color = color
      },
      nodes: () => {
        const found = live()
        if (!found) return Object.freeze([])
        found.recomputeInsideNodes()
        return Object.freeze(
          found._nodes
            .map((node) => handleForNode(node))
            .filter((node): node is NodeHandle => !!node)
        )
      },
      getBounds: () => {
        const [x, y, width, height] = live()?._bounding ?? [0, 0, 0, 0]
        return Object.freeze({ x, y, width, height })
      },
      centerOn: () => {
        const canvas = extensionValue(LGraphCanvas.active_canvas)
        const found = live()
        if (!canvas || !found || canvas.graph !== found.graph) return
        const [x, y, width, height] = found._bounding
        const { scale } = canvas.ds
        const dpi = window.devicePixelRatio || 1
        canvas.ds.offset[0] =
          -x - width * 0.5 + (canvas.canvas.width * 0.5) / (scale * dpi)
        canvas.ds.offset[1] =
          -y - height * 0.5 + (canvas.canvas.height * 0.5) / (scale * dpi)
        canvas.setDirty(true, true)
      }
    })
    cache.set(group, handle)
    return handle
  }
}
