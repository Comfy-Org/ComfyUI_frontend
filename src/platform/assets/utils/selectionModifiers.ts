export interface SelectionModifiers {
  shift: boolean
  cmdOrCtrl: boolean
}

export function toSelectionModifiers(e: {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): SelectionModifiers {
  return { shift: e.shiftKey, cmdOrCtrl: e.ctrlKey || e.metaKey }
}
