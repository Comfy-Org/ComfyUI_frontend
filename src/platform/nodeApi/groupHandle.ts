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
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import type { Bounds, NodeHandle } from './nodeHandle'

export interface GroupHandle {
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
  handleFor: (nodeId: string) => NodeHandle | undefined
) {
  return function groupHandle(group: LGraphGroup): GroupHandle {
    const contained = () => {
      // The group's own recompute, so membership matches what the renderer
      // draws rather than a rectangle test that drifts from it.
      group.recomputeInsideNodes()
      return group._nodes
    }

    return Object.freeze({
      id: String(group.id),
      getTitle: () => group.title,
      setTitle: (title: string) => {
        group.title = title
      },
      getColor: () => group.color,
      setColor: (color: string) => {
        group.color = color
      },
      nodes: () =>
        Object.freeze(
          contained()
            .map((node) => handleFor(String(node.id)))
            .filter((node): node is NodeHandle => !!node)
        ),
      getBounds: () => {
        const [x, y, width, height] = group._bounding
        return Object.freeze({ x, y, width, height })
      },
      centerOn: () => {
        const canvas = LGraphCanvas.active_canvas
        if (!canvas) return
        const [x, y, width, height] = group._bounding
        const { scale } = canvas.ds
        const dpi = window?.devicePixelRatio || 1
        canvas.ds.offset[0] =
          -x - width * 0.5 + (canvas.canvas.width * 0.5) / (scale * dpi)
        canvas.ds.offset[1] =
          -y - height * 0.5 + (canvas.canvas.height * 0.5) / (scale * dpi)
        canvas.setDirty(true, true)
      }
    })
  }
}
