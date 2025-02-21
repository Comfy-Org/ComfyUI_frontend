import '@comfyorg/litegraph'
import type { LLink, Size } from '@comfyorg/litegraph'

import type { DOMWidget } from '@/scripts/domWidget'
import type { ComfyNodeDef } from '@/types/apiTypes'

import type { NodeId } from './comfyWorkflow'

/** ComfyUI extensions of litegraph */
declare module '@comfyorg/litegraph/dist/types/widgets' {
  interface IWidgetOptions {
    /** Currently used by DOM widgets only.  Declaring here reduces complexity. */
    onHide?: (widget: DOMWidget) => void
  }

  interface IBaseWidget {
    onRemove?: () => void
    beforeQueued?: () => unknown
    afterQueued?: () => unknown
    serializeValue?: (
      node: LGraphNode,
      index: number
    ) => Promise<unknown> | unknown

    /**
     * Refreshes the widget's value or options from its remote source.
     */
    refresh?: () => unknown

    /**
     * If the widget supports dynamic prompts, this will be set to true.
     * See extensions/core/dynamicPrompts.ts
     */
    dynamicPrompts?: boolean

    /**
     * Widget conversion fields
     */
    origType?: string
    origComputeSize?: (width: number) => Size
    origSerializeValue?: (
      node: LGraphNode,
      index: number
    ) => Promise<unknown> | unknown
  }
}

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
    onGraphConfigured?(): void
    onExecuted?(output: any): void
    onNodeCreated?(this: LGraphNode): void
    setInnerNodes?(nodes: LGraphNode[]): void
    getInnerNodes?(): LGraphNode[]
    convertToNodes?(): LGraphNode[]
    recreate?(): Promise<LGraphNode>
    refreshComboInNode?(defs: Record<string, ComfyNodeDef>)
    applyToGraph?(extraLinks?: LLink[]): void
    updateLink?(link: LLink): LLink | null
    onExecutionStart?(): unknown
    /**
     * Callback invoked when the node is dragged over from an external source, i.e.
     * a file or another HTML element.
     * @param e The drag event
     * @returns {boolean} True if the drag event should be handled by this node, false otherwise
     */
    onDragOver?(e: DragEvent): boolean
    /**
     * Callback invoked when the node is dropped from an external source, i.e.
     * a file or another HTML element.
     * @param e The drag event
     * @returns {boolean} True if the drag event should be handled by this node, false otherwise
     */
    onDragDrop?(e: DragEvent): Promise<boolean> | boolean

    index?: number
    runningInternalNodeId?: NodeId

    comfyClass?: string

    /**
     * If the node is a frontend only node and should not be serialized into the prompt.
     */
    isVirtualNode?: boolean

    addDOMWidget(
      name: string,
      type: string,
      element: HTMLElement,
      options?: Record<string, any>
    ): DOMWidget

    animatedImages?: boolean
    imgs?: HTMLImageElement[]
    images?: ExecutedWsMessage['output']

    preview: string[]
    /** Index of the currently selected image on a multi-image node such as Preview Image */
    imageIndex?: number | null
    imageRects: Rect[]
    overIndex?: number | null
    pointerDown?: { index: number | null; pos: Point } | null

    setSizeForImage?(force?: boolean): void
    /** @deprecated Unused */
    inputHeight?: unknown

    /** @deprecated Unused */
    imageOffset?: number
    /** Callback for pasting an image file into the node */
    pasteFile?(file: File): void
    /** Callback for pasting multiple files into the node */
    pasteFiles?(files: File[]): void
  }
}

/**
 * Extended types for litegraph, to be merged upstream once it has stabilized.
 */
declare module '@comfyorg/litegraph' {
  /**
   * widgets_values is set to LGraphNode by `LGraphNode.configure`, but it is not
   * used by litegraph internally. We should remove the dependency on it later.
   */
  interface LGraphNode {
    widgets_values?: unknown[]
  }
}
