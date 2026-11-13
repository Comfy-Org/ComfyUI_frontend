import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'

/** True while the user drags a link, resizes a node or drags a widget. */
export function isInteracting(source: CanvasSource | undefined): boolean {
  const canvas = source?.canvas()
  if (!canvas) return false
  return (
    canvas.linkConnector.isConnecting ||
    canvas.resizing_node != null ||
    canvas.node_widget != null
  )
}
