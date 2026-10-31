export interface CanvasInteractionModeReader {
  isSelectOnly(): boolean
}

export const EDITABLE_INTERACTION_MODE: CanvasInteractionModeReader = {
  isSelectOnly: () => false
}
