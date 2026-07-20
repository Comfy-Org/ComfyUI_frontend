export type NodeKey = 'load' | 'camera' | 'edit' | 'save'

export interface NodeRect {
  left: number
  top: number
  width: number
  height: number
}

export const GRAPH: {
  canvas: { width: number; height: number }
  nodes: Record<NodeKey, NodeRect>
} = {
  canvas: { width: 95, height: 41 },
  nodes: {
    load: { left: 0, top: 2.5, width: 23, height: 21.8 },
    camera: { left: 25.5, top: 0, width: 22, height: 38.9 },
    edit: { left: 50, top: 0.75, width: 19.5, height: 36.6 },
    save: { left: 72, top: 3.5, width: 23, height: 20.2 }
  }
}

export const NODE_KEYS: NodeKey[] = ['load', 'camera', 'edit', 'save']

const HEADER_HEIGHT = 2.25
const PORT_ROW_HEIGHT = 1.5

export function portY(top: number, row: number, collapsed: boolean): number {
  if (collapsed) return top + HEADER_HEIGHT / 2
  return top + HEADER_HEIGHT + PORT_ROW_HEIGHT * row + PORT_ROW_HEIGHT / 2
}
