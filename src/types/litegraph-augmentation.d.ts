import '@comfyorg/litegraph'
import type { ComfyNodeDef } from '@/types/apiTypes'
import type { LLink } from '@comfyorg/litegraph'

/**
 *  ComfyUI extensions of litegraph
 */
declare module '@comfyorg/litegraph' {
  interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
    type?: string
    comfyClass: string
    title: string
    nodeData?: ComfyNodeDef
    category?: string
    new (): T
  }

  interface LGraphNode {
    constructor: LGraphNodeConstructor

    /**
     * Callback fired on each node after the graph is configured
     */
    onAfterGraphConfigured?(): void
    onNodeCreated?(this: LGraphNode): void
    setInnerNodes?(nodes: LGraphNode[]): void
    applyToGraph?(extraLinks?: LLink[]): void
    updateLink?(link: LLink): LLink | null

    comfyClass?: string

    /**
     * If the node is a frontend only node and should not be serialized into the prompt.
     */
    isVirtualNode?: boolean

    addDOMWidget(
      name: string,
      type: string,
      element: HTMLElement,
      options: Record<string, any>
    ): DOMWidget
  }

  interface IWidget<TValue = any, TOptions = any> {
    type?: string

    /**
     * Allows for additional cleanup when removing a widget when converting to input.
     */
    onRemove?(): void

    serializeValue?(node?: LGraphNode, i?: string)
    beforeQueued?(): void

    /**
     * DOM element used for the widget
     */
    element?: HTMLElement

    tooltip?: string

    origType?: IWidget['type']
    origComputeSize?: IWidget['computeSize']
    origSerializeValue?: IWidget['serializeValue']
  }

  interface INodeSlot {
    widget?: unknown & { name?: string }
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

  interface ContextMenu {
    root?: HTMLDivElement
  }
}
