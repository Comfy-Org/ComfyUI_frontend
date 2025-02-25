import '@comfyorg/litegraph'
import type { LLink, Size } from '@comfyorg/litegraph'

import type { DOMWidget, DOMWidgetOptions } from '@/scripts/domWidget'
import type { ComfyNodeDef } from '@/types/apiTypes'

import type { NodeId } from './comfyWorkflow'

/** ComfyUI extensions of litegraph */
declare module '@comfyorg/litegraph/dist/types/widgets' {
  interface IWidgetOptions {
    /** Currently used by DOM widgets only.  Declaring here reduces complexity. */
    onHide?: (widget: DOMWidget) => void
    /**
     * Controls whether the widget's value is included in the API workflow/prompt.
     * - If false, the value will be excluded from the API workflow but still serialized as part of the graph state
     * - If true or undefined, the value will be included in both the API workflow and graph state
     */
    serialize?: boolean
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
    /** @deprecated groupNode */
    setInnerNodes?(nodes: LGraphNode[]): void
    /** Originally a group node API. */
    getInnerNodes?(): LGraphNode[]
    /** @deprecated groupNode */
    convertToNodes?(): LGraphNode[]
    recreate?(): Promise<LGraphNode>
    refreshComboInNode?(defs: Record<string, ComfyNodeDef>)
    /** @deprecated groupNode */
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

    addDOMWidget<
      T extends HTMLElement = HTMLElement,
      V extends object | string = string
    >(
      name: string,
      type: string,
      element: T,
      options?: DOMWidgetOptions<T, V>
    ): DOMWidget<T, V>

    animatedImages?: boolean
    imgs?: HTMLImageElement[]
    images?: ExecutedWsMessage['output']
    /** Container for the node's video preview */
    videoContainer?: HTMLElement
    /** Whether the node's preview media is loading */
    isLoading?: boolean
    /** The content type of the node's preview media */
    previewMediaType?: 'image' | 'video' | 'audio' | 'model'

    preview: string[]
    /** Index of the currently selected image on a multi-image node such as Preview Image */
    imageIndex?: number | null
    imageRects: Rect[]
    overIndex?: number | null
    pointerDown?: { index: number | null; pos: Point } | null

    setSizeForImage?(force?: boolean): void
    /** @deprecated Unused */
    inputHeight?: unknown

    /** The y offset of the image preview to the top of the node body. */
    imageOffset?: number
    /** Callback for pasting an image file into the node */
    pasteFile?(file: File): void
    /** Callback for pasting multiple files into the node */
    pasteFiles?(files: File[]): void
  }
  /**
   * Only used by the Primitive node. Primitive node is using the widget property
   * to store/access the widget config.
   * We should remove this hacky solution once we have a proper solution.
   */
  interface INodeOutputSlot {
    widget?: IWidget
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
