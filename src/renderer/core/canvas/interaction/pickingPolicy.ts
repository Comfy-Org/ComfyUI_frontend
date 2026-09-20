export interface PickingPolicy {
  canSelectNodes: boolean
  canEditNodes: boolean
  canOpenMenus: boolean
  canFocusWidgets: boolean
  suppressesCanvasInfo: boolean
}

export function resolvePickingPolicy({
  readOnly,
  picking
}: {
  readOnly: boolean
  picking: boolean
}): PickingPolicy {
  return {
    canSelectNodes: !readOnly,
    canEditNodes: !readOnly && !picking,
    canOpenMenus: !readOnly && !picking,
    canFocusWidgets: !picking,
    suppressesCanvasInfo: picking
  }
}
