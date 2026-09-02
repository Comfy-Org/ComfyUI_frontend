/**
 * Editor interaction state.
 *
 * This file used to publish renderer metrics — slot height, title height,
 * corner radius, which renderer is running. Every pack that reached for them
 * was reimplementing editor geometry from the numbers, and getting it wrong for
 * anything but the default vertical layout. They are replaced by asking the
 * renderer directly: `node.getBounds()`, `node.getSlotPosition()` and
 * `graph.nodeAt()`. What a node draws, and how, is not the node API's business.
 */
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

/**
 * Whether the editor is already in the middle of a gesture — dragging a link,
 * resizing a node, or dragging a widget.
 *
 * A pack that runs its own pointer gesture must stand down while this is true,
 * or it fires in the middle of the user doing something else. Two kjnodes files
 * read `connecting_links`, `resizing_node` and `node_widget` off the canvas to
 * ask exactly this, and they are the same question, not three.
 *
 * A boolean rather than the state itself: which gestures exist, and what they
 * are called, is the editor's business and will change.
 */
export function isInteracting(): boolean {
  const canvas = LGraphCanvas.active_canvas
  if (!canvas) return false
  return (
    canvas.connecting_links != null ||
    canvas.resizing_node != null ||
    canvas.node_widget != null
  )
}
