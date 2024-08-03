import '@comfyorg/litegraph'

/**
 *  ComfyUI extensions of litegraph
 */
declare module '@comfyorg/litegraph' {
  interface LGraphNode {
    /**
     * Callback fired on each node after the graph is configured
     */
    onAfterGraphConfigured?(): void

    /**
     * If the node is a frontend only node and should not be serialized into the prompt.
     */
    isVirtualNode?: boolean
  }

  interface IWidget<TValue = any, TOptions = any> {
    /**
     * Allows for additional cleanup when removing a widget when converting to input.
     */
    onRemove?(): void

    /**
     * DOM element used for the widget
     */
    element?: HTMLElement

    tooltip?: string
  }

  interface INodeOutputSlot {
    widget?: unknown
  }

  interface INodeInputSlot {
    widget?: unknown
  }
}

/**
 * Extended types for litegraph, to be merged upstream once it has stabilized.
 */
declare module '@comfyorg/litegraph' {
  interface INodeInputSlot {
    pos?: [number, number]
  }

  interface LGraphNode {
    widgets_values?: unknown[]
  }

  interface LGraphCanvas {
    /** This is in the litegraph types but has incorrect return type */
    isOverNodeInput(
      node: LGraphNode,
      canvasX: number,
      canvasY: number,
      slotPos: Vector2
    ): number

    isOverNodeOutput(
      node: LGraphNode,
      canvasX: number,
      canvasY: number,
      slotPos: Vector2
    ): number
  }
}
