export interface PickingPolicy {
  canSelectNodes: boolean
  canEditNodes: boolean
  canFocusWidgets: boolean
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
    canFocusWidgets: !picking
  }
}
