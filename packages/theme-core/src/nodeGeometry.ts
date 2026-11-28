/** Vue node geometry, in CSS px, that a theme stylesheet may change. */
export interface NodeGeometry {
  headerHeight: number
  slotInset: number
  slotBlockMarginBottom: number
  socketRowOverlap: number
}

const DEFAULT_NODE_GEOMETRY: NodeGeometry = {
  headerHeight: 28,
  slotInset: 0,
  slotBlockMarginBottom: 0,
  socketRowOverlap: 2
}

const STYLESHEET_NODE_GEOMETRY: Record<string, Partial<NodeGeometry>> = {
  classic: {
    headerHeight: 30,
    slotInset: 10,
    slotBlockMarginBottom: -2,
    socketRowOverlap: 0
  }
}

/** The node geometry a theme stylesheet renders. */
export function nodeGeometryOf(stylesheet: string | undefined): NodeGeometry {
  return {
    ...DEFAULT_NODE_GEOMETRY,
    ...(stylesheet ? STYLESHEET_NODE_GEOMETRY[stylesheet] : undefined)
  }
}

/** The `--node-*` custom properties a stylesheet reads its node geometry from. */
export function nodeGeometryStyle(geometry: NodeGeometry) {
  return {
    '--node-header-height': `${geometry.headerHeight}px`,
    '--node-slot-inset': `${geometry.slotInset}px`,
    '--node-slot-block-margin-bottom': `${geometry.slotBlockMarginBottom}px`,
    '--node-socket-row-overlap': `${geometry.socketRowOverlap}px`
  }
}
