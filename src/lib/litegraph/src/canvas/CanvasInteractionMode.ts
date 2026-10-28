/**
 * Tells the canvas which interactions the host application allows right now.
 * The application implements it over its own state and hands it to
 * {@link LGraphCanvas} through `options.interactionMode`; litegraph never
 * reads application stores.
 */
export interface CanvasInteractionModeReader {
  /**
   * `true` while the canvas is a picking surface: nodes can be selected and
   * the view can be panned and zoomed, but nothing may change the graph.
   */
  isSelectOnly(): boolean
}

export const EDITABLE_INTERACTION_MODE: CanvasInteractionModeReader = {
  isSelectOnly: () => false
}
