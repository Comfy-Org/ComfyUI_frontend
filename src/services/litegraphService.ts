import {
  type IContextMenuValue,
  LGraphBadge,
  LGraphCanvas,
  LGraphEventMode,
  LGraphNode,
  LiteGraph,
  RenderShape,
  type Subgraph,
  SubgraphNode,
  type Vector2,
  createBounds
} from '@comfyorg/litegraph'
import type {
  ExportedSubgraphInstance,
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@comfyorg/litegraph/dist/types/serialisation'
import _ from 'lodash'

import { useNodeAnimatedImage } from '@/composables/node/useNodeAnimatedImage'
import { useNodeCanvasImagePreview } from '@/composables/node/useNodeCanvasImagePreview'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { st, t } from '@/i18n'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import type {
  ComfyNodeDef as ComfyNodeDefV2,
  InputSpec,
  OutputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyApp, app } from '@/scripts/app'
import { isComponentWidget, isDOMWidget } from '@/scripts/domWidget'
import { $el } from '@/scripts/ui'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import {
  isImageNode,
  isVideoNode,
  migrateWidgetsValues
} from '@/utils/litegraphUtil'

import { useExtensionService } from './extensionService'

export const CONFIG = Symbol()
export const GET_CONFIG = Symbol()

/**
 * Service that augments litegraph with ComfyUI specific functionality.
 */
export const useLitegraphService = () => {
  const extensionService = useExtensionService()
  const toastStore = useToastStore()
  const widgetStore = useWidgetStore()
  const canvasStore = useCanvasStore()

  // TODO: Dedupe `registerNodeDef`; this should remain synchronous.
  function registerSubgraphNodeDef(
    nodeDefV1: ComfyNodeDefV1,
    subgraph: Subgraph,
    instanceData: ExportedSubgraphInstance
  ) {
    const node = class ComfyNode extends SubgraphNode {
      static comfyClass: string
      static override title: string
      static override category: string
      static nodeData: ComfyNodeDefV1 & ComfyNodeDefV2

      /**
       * @internal The initial minimum size of the node.
       */
      #initialMinSize = { width: 1, height: 1 }
      /**
       * @internal The key for the node definition in the i18n file.
       */
      get #nodeKey(): string {
        return `nodeDefs.${normalizeI18nKey(ComfyNode.nodeData.name)}`
      }

      constructor() {
        super(app.graph, subgraph, instanceData)

        // Set up event listener for promoted widget registration
        subgraph.events.addEventListener('widget-promoted', (event) => {
          const { widget } = event.detail
          // Only handle DOM widgets
          if (!isDOMWidget(widget) && !isComponentWidget(widget)) return

          const domWidgetStore = useDomWidgetStore()
          if (!domWidgetStore.widgetStates.has(widget.id)) {
            domWidgetStore.registerWidget(widget)
            // Set initial visibility based on whether the widget's node is in the current graph
            const widgetState = domWidgetStore.widgetStates.get(widget.id)
            if (widgetState) {
              const currentGraph = canvasStore.getCanvas().graph
              widgetState.visible =
                currentGraph?.nodes.includes(widget.node) ?? false
            }
          }
        })

        // Set up event listener for promoted widget removal
        subgraph.events.addEventListener('widget-demoted', (event) => {
          const { widget } = event.detail
          // Only handle DOM widgets
          if (!isDOMWidget(widget) && !isComponentWidget(widget)) return

          const domWidgetStore = useDomWidgetStore()
          if (domWidgetStore.widgetStates.has(widget.id)) {
            domWidgetStore.unregisterWidget(widget.id)
          }
        })

        this.#setupStrokeStyles()
        this.#addInputs(ComfyNode.nodeData.inputs)
        this.#addOutputs(ComfyNode.nodeData.outputs)
        this.#setInitialSize()
        this.serialize_widgets = true
        void extensionService.invokeExtensionsAsync('nodeCreated', this)
        this.badges.push(
          new LGraphBadge({
            text: '',
            iconOptions: {
              unicode: '\ue96e',
              fontFamily: 'PrimeIcons',
              color: '#ffffff',
              fontSize: 12
            },
            fgColor: '#ffffff',
            bgColor: '#3b82f6'
          })
        )
      }

      /**
       * @internal Setup stroke styles for the node under various conditions.
       */
      #setupStrokeStyles() {
        this.strokeStyles['running'] = function (this: LGraphNode) {
          const nodeId = String(this.id)
          const nodeLocatorId = useWorkflowStore().nodeIdToNodeLocatorId(nodeId)
          const state =
            useExecutionStore().nodeLocationProgressStates[nodeLocatorId]?.state
          if (state === 'running') {
            return { color: '#0f0' }
          }
        }
        this.strokeStyles['nodeError'] = function (this: LGraphNode) {
          if (app.lastNodeErrors?.[this.id]?.errors) {
            return { color: 'red' }
          }
        }
        this.strokeStyles['dragOver'] = function (this: LGraphNode) {
          if (app.dragOverNode?.id == this.id) {
            return { color: 'dodgerblue' }
          }
        }
        this.strokeStyles['executionError'] = function (this: LGraphNode) {
          if (app.lastExecutionError?.node_id == this.id) {
            return { color: '#f0f', lineWidth: 2 }
          }
        }
      }

      /**
       * @internal Add input sockets to the node. (No widget)
       */
      #addInputSocket(inputSpec: InputSpec) {
        const inputName = inputSpec.name
        const nameKey = `${this.#nodeKey}.inputs.${normalizeI18nKey(inputName)}.name`
        const widgetConstructor = widgetStore.widgets.get(
          inputSpec.widgetType ?? inputSpec.type
        )
        if (widgetConstructor && !inputSpec.forceInput) return

        this.addInput(inputName, inputSpec.type, {
          shape: inputSpec.isOptional ? RenderShape.HollowCircle : undefined,
          localized_name: st(nameKey, inputName)
        })
      }

      /**
       * @internal Add a widget to the node. For both primitive types and custom widgets
       * (unless `socketless`), an input socket is also added.
       */
      #addInputWidget(inputSpec: InputSpec) {
        const widgetInputSpec = { ...inputSpec }
        if (inputSpec.widgetType) {
          widgetInputSpec.type = inputSpec.widgetType
        }
        const inputName = inputSpec.name
        const nameKey = `${this.#nodeKey}.inputs.${normalizeI18nKey(inputName)}.name`
        const widgetConstructor = widgetStore.widgets.get(widgetInputSpec.type)
        if (!widgetConstructor || inputSpec.forceInput) return

        const {
          widget,
          minWidth = 1,
          minHeight = 1
        } = widgetConstructor(
          this,
          inputName,
          transformInputSpecV2ToV1(widgetInputSpec),
          app
        ) ?? {}

        if (widget) {
          widget.label = st(nameKey, widget.label ?? inputName)
          widget.options ??= {}
          Object.assign(widget.options, {
            advanced: inputSpec.advanced,
            hidden: inputSpec.hidden
          })
        }

        if (!widget?.options?.socketless) {
          const inputSpecV1 = transformInputSpecV2ToV1(widgetInputSpec)
          this.addInput(inputName, inputSpec.type, {
            shape: inputSpec.isOptional ? RenderShape.HollowCircle : undefined,
            localized_name: st(nameKey, inputName),
            widget: { name: inputName, [GET_CONFIG]: () => inputSpecV1 }
          })
        }

        this.#initialMinSize.width = Math.max(
          this.#initialMinSize.width,
          minWidth
        )
        this.#initialMinSize.height = Math.max(
          this.#initialMinSize.height,
          minHeight
        )
      }

      /**
       * @internal Add inputs to the node.
       */
      #addInputs(inputs: Record<string, InputSpec>) {
        for (const inputSpec of Object.values(inputs))
          this.#addInputSocket(inputSpec)
        for (const inputSpec of Object.values(inputs))
          this.#addInputWidget(inputSpec)
      }

      /**
       * @internal Add outputs to the node.
       */
      #addOutputs(outputs: OutputSpec[]) {
        for (const output of outputs) {
          const { name, type, is_list } = output
          const shapeOptions = is_list ? { shape: LiteGraph.GRID_SHAPE } : {}
          const nameKey = `${this.#nodeKey}.outputs.${output.index}.name`
          const typeKey = `dataTypes.${normalizeI18nKey(type)}`
          const outputOptions = {
            ...shapeOptions,
            // If the output name is different from the output type, use the output name.
            // e.g.
            // - type ("INT"); name ("Positive") => translate name
            // - type ("FLOAT"); name ("FLOAT") => translate type
            localized_name:
              type !== name ? st(nameKey, name) : st(typeKey, name)
          }
          this.addOutput(name, type, outputOptions)
        }
      }

      /**
       * @internal Set the initial size of the node.
       */
      #setInitialSize() {
        const s = this.computeSize()
        // Expand the width a little to fit widget values on screen.
        const pad =
          this.widgets?.length &&
          !useSettingStore().get('LiteGraph.Node.DefaultPadding')
        s[0] = Math.max(this.#initialMinSize.width, s[0] + (pad ? 60 : 0))
        s[1] = Math.max(this.#initialMinSize.height, s[1])
        this.setSize(s)
      }

      /**
       * Configure the node from a serialised node. Keep 'name', 'type', 'shape',
       * and 'localized_name' information from the original node definition.
       */
      override configure(data: ISerialisedNode): void {
        const RESERVED_KEYS = ['name', 'type', 'shape', 'localized_name']

        // Note: input name is unique in a node definition, so we can lookup
        // input by name.
        const inputByName = new Map<string, ISerialisableNodeInput>(
          data.inputs?.map((input) => [input.name, input]) ?? []
        )
        // Inputs defined by the node definition.
        const definedInputNames = new Set(
          this.inputs.map((input) => input.name)
        )
        const definedInputs = this.inputs.map((input) => {
          const inputData = inputByName.get(input.name)
          return inputData
            ? {
                ...inputData,
                // Whether the input has associated widget follows the
                // original node definition.
                ..._.pick(input, RESERVED_KEYS.concat('widget'))
              }
            : input
        })
        // Extra inputs that potentially dynamically added by custom js logic.
        const extraInputs = data.inputs?.filter(
          (input) => !definedInputNames.has(input.name)
        )
        data.inputs = [...definedInputs, ...(extraInputs ?? [])]

        // Note: output name is not unique, so we cannot lookup output by name.
        // Use index instead.
        data.outputs = _.zip(this.outputs, data.outputs).map(
          ([output, outputData]) => {
            // If there are extra outputs in the serialised node, use them directly.
            // There are currently custom nodes that dynamically add outputs via
            // js logic.
            if (!output) return outputData as ISerialisableNodeOutput

            return outputData
              ? {
                  ...outputData,
                  ..._.pick(output, RESERVED_KEYS)
                }
              : output
          }
        )

        data.widgets_values = migrateWidgetsValues(
          ComfyNode.nodeData.inputs,
          this.widgets ?? [],
          data.widgets_values ?? []
        )

        super.configure(data)
      }
    }

    addNodeContextMenuHandler(node)
    addDrawBackgroundHandler(node)
    addNodeKeyHandler(node)
    // Note: Some extensions expects node.comfyClass to be set in
    // `beforeRegisterNodeDef`.
    node.prototype.comfyClass = nodeDefV1.name
    node.comfyClass = nodeDefV1.name

    const nodeDef = new ComfyNodeDefImpl(nodeDefV1)
    node.nodeData = nodeDef
    LiteGraph.registerNodeType(subgraph.id, node)
    // Note: Do not following assignments before `LiteGraph.registerNodeType`
    // because `registerNodeType` will overwrite the assignments.
    node.category = nodeDef.category
    node.title = nodeDef.display_name || nodeDef.name
  }

  async function registerNodeDef(nodeId: string, nodeDefV1: ComfyNodeDefV1) {
    const node = class ComfyNode extends LGraphNode {
      static comfyClass: string
      static override title: string
      static override category: string
      static nodeData: ComfyNodeDefV1 & ComfyNodeDefV2

      /**
       * @internal The initial minimum size of the node.
       */
      #initialMinSize = { width: 1, height: 1 }
      /**
       * @internal The key for the node definition in the i18n file.
       */
      get #nodeKey(): string {
        return `nodeDefs.${normalizeI18nKey(ComfyNode.nodeData.name)}`
      }

      constructor(title: string) {
        super(title)
        this.#setupStrokeStyles()
        this.#addInputs(ComfyNode.nodeData.inputs)
        this.#addOutputs(ComfyNode.nodeData.outputs)
        this.#setInitialSize()
        this.serialize_widgets = true

        // Mark API Nodes yellow by default to distinguish with other nodes.
        if (ComfyNode.nodeData.api_node) {
          this.color = LGraphCanvas.node_colors.yellow.color
          this.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
        }

        void extensionService.invokeExtensionsAsync('nodeCreated', this)
      }

      /**
       * @internal Setup stroke styles for the node under various conditions.
       */
      #setupStrokeStyles() {
        this.strokeStyles['running'] = function (this: LGraphNode) {
          const nodeId = String(this.id)
          const nodeLocatorId = useWorkflowStore().nodeIdToNodeLocatorId(nodeId)
          const state =
            useExecutionStore().nodeLocationProgressStates[nodeLocatorId]?.state
          if (state === 'running') {
            return { color: '#0f0' }
          }
        }
        this.strokeStyles['nodeError'] = function (this: LGraphNode) {
          if (app.lastNodeErrors?.[this.id]?.errors) {
            return { color: 'red' }
          }
        }
        this.strokeStyles['dragOver'] = function (this: LGraphNode) {
          if (app.dragOverNode?.id == this.id) {
            return { color: 'dodgerblue' }
          }
        }
        this.strokeStyles['executionError'] = function (this: LGraphNode) {
          if (app.lastExecutionError?.node_id == this.id) {
            return { color: '#f0f', lineWidth: 2 }
          }
        }
      }

      /**
       * @internal Add input sockets to the node. (No widget)
       */
      #addInputSocket(inputSpec: InputSpec) {
        const inputName = inputSpec.name
        const nameKey = `${this.#nodeKey}.inputs.${normalizeI18nKey(inputName)}.name`
        const widgetConstructor = widgetStore.widgets.get(
          inputSpec.widgetType ?? inputSpec.type
        )
        if (widgetConstructor && !inputSpec.forceInput) return

        this.addInput(inputName, inputSpec.type, {
          shape: inputSpec.isOptional ? RenderShape.HollowCircle : undefined,
          localized_name: st(nameKey, inputName)
        })
      }

      /**
       * @internal Add a widget to the node. For both primitive types and custom widgets
       * (unless `socketless`), an input socket is also added.
       */
      #addInputWidget(inputSpec: InputSpec) {
        const widgetInputSpec = { ...inputSpec }
        if (inputSpec.widgetType) {
          widgetInputSpec.type = inputSpec.widgetType
        }
        const inputName = inputSpec.name
        const nameKey = `${this.#nodeKey}.inputs.${normalizeI18nKey(inputName)}.name`
        const widgetConstructor = widgetStore.widgets.get(widgetInputSpec.type)
        if (!widgetConstructor || inputSpec.forceInput) return

        const {
          widget,
          minWidth = 1,
          minHeight = 1
        } = widgetConstructor(
          this,
          inputName,
          transformInputSpecV2ToV1(widgetInputSpec),
          app
        ) ?? {}

        if (widget) {
          widget.label = st(nameKey, widget.label ?? inputName)
          widget.options ??= {}
          Object.assign(widget.options, {
            advanced: inputSpec.advanced,
            hidden: inputSpec.hidden
          })
        }

        if (!widget?.options?.socketless) {
          const inputSpecV1 = transformInputSpecV2ToV1(widgetInputSpec)
          this.addInput(inputName, inputSpec.type, {
            shape: inputSpec.isOptional ? RenderShape.HollowCircle : undefined,
            localized_name: st(nameKey, inputName),
            widget: { name: inputName, [GET_CONFIG]: () => inputSpecV1 }
          })
        }

        this.#initialMinSize.width = Math.max(
          this.#initialMinSize.width,
          minWidth
        )
        this.#initialMinSize.height = Math.max(
          this.#initialMinSize.height,
          minHeight
        )
      }

      /**
       * @internal Add inputs to the node.
       */
      #addInputs(inputs: Record<string, InputSpec>) {
        for (const inputSpec of Object.values(inputs))
          this.#addInputSocket(inputSpec)
        for (const inputSpec of Object.values(inputs))
          this.#addInputWidget(inputSpec)
      }

      /**
       * @internal Add outputs to the node.
       */
      #addOutputs(outputs: OutputSpec[]) {
        for (const output of outputs) {
          const { name, type, is_list } = output
          const shapeOptions = is_list ? { shape: LiteGraph.GRID_SHAPE } : {}
          const nameKey = `${this.#nodeKey}.outputs.${output.index}.name`
          const typeKey = `dataTypes.${normalizeI18nKey(type)}`
          const outputOptions = {
            ...shapeOptions,
            // If the output name is different from the output type, use the output name.
            // e.g.
            // - type ("INT"); name ("Positive") => translate name
            // - type ("FLOAT"); name ("FLOAT") => translate type
            localized_name:
              type !== name ? st(nameKey, name) : st(typeKey, name)
          }
          this.addOutput(name, type, outputOptions)
        }
      }

      /**
       * @internal Set the initial size of the node.
       */
      #setInitialSize() {
        const s = this.computeSize()
        // Expand the width a little to fit widget values on screen.
        const pad =
          this.widgets?.length &&
          !useSettingStore().get('LiteGraph.Node.DefaultPadding')
        s[0] = Math.max(this.#initialMinSize.width, s[0] + (pad ? 60 : 0))
        s[1] = Math.max(this.#initialMinSize.height, s[1])
        this.setSize(s)
      }

      /**
       * Configure the node from a serialised node. Keep 'name', 'type', 'shape',
       * and 'localized_name' information from the original node definition.
       */
      override configure(data: ISerialisedNode): void {
        const RESERVED_KEYS = ['name', 'type', 'shape', 'localized_name']

        // Note: input name is unique in a node definition, so we can lookup
        // input by name.
        const inputByName = new Map<string, ISerialisableNodeInput>(
          data.inputs?.map((input) => [input.name, input]) ?? []
        )
        // Inputs defined by the node definition.
        const definedInputNames = new Set(
          this.inputs.map((input) => input.name)
        )
        const definedInputs = this.inputs.map((input) => {
          const inputData = inputByName.get(input.name)
          return inputData
            ? {
                ...inputData,
                // Whether the input has associated widget follows the
                // original node definition.
                ..._.pick(input, RESERVED_KEYS.concat('widget'))
              }
            : input
        })
        // Extra inputs that potentially dynamically added by custom js logic.
        const extraInputs = data.inputs?.filter(
          (input) => !definedInputNames.has(input.name)
        )
        data.inputs = [...definedInputs, ...(extraInputs ?? [])]

        // Note: output name is not unique, so we cannot lookup output by name.
        // Use index instead.
        data.outputs = _.zip(this.outputs, data.outputs).map(
          ([output, outputData]) => {
            // If there are extra outputs in the serialised node, use them directly.
            // There are currently custom nodes that dynamically add outputs via
            // js logic.
            if (!output) return outputData as ISerialisableNodeOutput

            return outputData
              ? {
                  ...outputData,
                  ..._.pick(output, RESERVED_KEYS)
                }
              : output
          }
        )

        data.widgets_values = migrateWidgetsValues(
          ComfyNode.nodeData.inputs,
          this.widgets ?? [],
          data.widgets_values ?? []
        )

        super.configure(data)
      }
    }

    addNodeContextMenuHandler(node)
    addDrawBackgroundHandler(node)
    addNodeKeyHandler(node)
    // Note: Some extensions expects node.comfyClass to be set in
    // `beforeRegisterNodeDef`.
    node.prototype.comfyClass = nodeDefV1.name
    node.comfyClass = nodeDefV1.name
    await extensionService.invokeExtensionsAsync(
      'beforeRegisterNodeDef',
      node,
      nodeDefV1 // Receives V1 NodeDef, and potentially make modifications to it
    )

    const nodeDef = new ComfyNodeDefImpl(nodeDefV1)
    node.nodeData = nodeDef
    LiteGraph.registerNodeType(nodeId, node)
    // Note: Do not following assignments before `LiteGraph.registerNodeType`
    // because `registerNodeType` will overwrite the assignments.
    node.category = nodeDef.category
    node.title = nodeDef.display_name || nodeDef.name
  }

  /**
   * Adds special context menu handling for nodes
   * e.g. this adds Open Image functionality for nodes that show images
   * @param {*} node The node to add the menu handler
   */
  function addNodeContextMenuHandler(node: typeof LGraphNode) {
    function getCopyImageOption(img: HTMLImageElement): IContextMenuValue[] {
      if (typeof window.ClipboardItem === 'undefined') return []
      return [
        {
          content: 'Copy Image',
          // @ts-expect-error: async callback is not accepted by litegraph
          callback: async () => {
            const url = new URL(img.src)
            url.searchParams.delete('preview')

            // @ts-expect-error fixme ts strict error
            const writeImage = async (blob) => {
              await navigator.clipboard.write([
                new ClipboardItem({
                  [blob.type]: blob
                })
              ])
            }

            try {
              const data = await fetch(url)
              const blob = await data.blob()
              try {
                await writeImage(blob)
              } catch (error) {
                // Chrome seems to only support PNG on write, convert and try again
                if (blob.type !== 'image/png') {
                  const canvas = $el('canvas', {
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  }) as HTMLCanvasElement
                  const ctx = canvas.getContext('2d')
                  // @ts-expect-error fixme ts strict error
                  let image
                  if (typeof window.createImageBitmap === 'undefined') {
                    image = new Image()
                    const p = new Promise((resolve, reject) => {
                      // @ts-expect-error fixme ts strict error
                      image.onload = resolve
                      // @ts-expect-error fixme ts strict error
                      image.onerror = reject
                    }).finally(() => {
                      // @ts-expect-error fixme ts strict error
                      URL.revokeObjectURL(image.src)
                    })
                    image.src = URL.createObjectURL(blob)
                    await p
                  } else {
                    image = await createImageBitmap(blob)
                  }
                  try {
                    // @ts-expect-error fixme ts strict error
                    ctx.drawImage(image, 0, 0)
                    canvas.toBlob(writeImage, 'image/png')
                  } finally {
                    // @ts-expect-error fixme ts strict error
                    if (typeof image.close === 'function') {
                      // @ts-expect-error fixme ts strict error
                      image.close()
                    }
                  }

                  return
                }
                throw error
              }
            } catch (error) {
              toastStore.addAlert(
                t('toastMessages.errorCopyImage', {
                  // @ts-expect-error fixme ts strict error
                  error: error.message ?? error
                })
              )
            }
          }
        }
      ]
    }

    node.prototype.getExtraMenuOptions = function (_, options) {
      if (this.imgs) {
        // If this node has images then we add an open in new tab item
        let img
        if (this.imageIndex != null) {
          // An image is selected so select that
          img = this.imgs[this.imageIndex]
        } else if (this.overIndex != null) {
          // No image is selected but one is hovered
          img = this.imgs[this.overIndex]
        }
        if (img) {
          options.unshift(
            {
              content: 'Open Image',
              callback: () => {
                const url = new URL(img.src)
                url.searchParams.delete('preview')
                window.open(url, '_blank')
              }
            },
            ...getCopyImageOption(img),
            {
              content: 'Save Image',
              callback: () => {
                const a = document.createElement('a')
                const url = new URL(img.src)
                url.searchParams.delete('preview')
                a.href = url.toString()
                a.setAttribute(
                  'download',
                  // @ts-expect-error fixme ts strict error
                  new URLSearchParams(url.search).get('filename')
                )
                document.body.append(a)
                a.click()
                requestAnimationFrame(() => a.remove())
              }
            }
          )
        }
      }

      options.push({
        content: 'Bypass',
        callback: () => {
          const mode =
            this.mode === LGraphEventMode.BYPASS
              ? LGraphEventMode.ALWAYS
              : LGraphEventMode.BYPASS
          for (const item of app.canvas.selectedItems) {
            if (item instanceof LGraphNode) item.mode = mode
          }
          // @ts-expect-error fixme ts strict error
          this.graph.change()
        }
      })

      // prevent conflict of clipspace content
      if (!ComfyApp.clipspace_return_node) {
        options.push({
          content: 'Copy (Clipspace)',
          callback: () => {
            ComfyApp.copyToClipspace(this)
          }
        })

        if (ComfyApp.clipspace != null) {
          options.push({
            content: 'Paste (Clipspace)',
            callback: () => {
              ComfyApp.pasteFromClipspace(this)
            }
          })
        }

        if (isImageNode(this)) {
          options.push({
            content: 'Open in MaskEditor | Image Canvas',
            callback: () => {
              ComfyApp.copyToClipspace(this)
              // @ts-expect-error fixme ts strict error
              ComfyApp.clipspace_return_node = this
              // @ts-expect-error fixme ts strict error
              ComfyApp.open_maskeditor()
            }
          })
        }
      }

      return []
    }
  }

  /**
   * Adds Custom drawing logic for nodes
   * e.g. Draws images and handles thumbnail navigation on nodes that output images
   * @param {*} node The node to add the draw handler
   */
  function addDrawBackgroundHandler(node: typeof LGraphNode) {
    /**
     * @deprecated No longer needed as we use {@link useImagePreviewWidget}
     */
    node.prototype.setSizeForImage = function (this: LGraphNode) {
      console.warn(
        'node.setSizeForImage is deprecated. Now it has no effect. Please remove the call to it.'
      )
    }

    function unsafeDrawBackground(this: LGraphNode) {
      if (this.flags.collapsed) return

      const nodeOutputStore = useNodeOutputStore()
      const { showAnimatedPreview, removeAnimatedPreview } =
        useNodeAnimatedImage()
      const { showCanvasImagePreview, removeCanvasImagePreview } =
        useNodeCanvasImagePreview()

      const output = nodeOutputStore.getNodeOutputs(this)
      const preview = nodeOutputStore.getNodePreviews(this)

      const isNewOutput = output && this.images !== output.images
      const isNewPreview = preview && this.preview !== preview

      if (isNewPreview) this.preview = preview
      if (isNewOutput) this.images = output.images

      if (isNewOutput || isNewPreview) {
        this.animatedImages = output?.animated?.find(Boolean)

        const isAnimatedWebp =
          this.animatedImages &&
          // @ts-expect-error fixme ts strict error
          output.images.some((img) => img.filename?.includes('webp'))
        const isVideo =
          (this.animatedImages && !isAnimatedWebp) || isVideoNode(this)
        if (isVideo) {
          useNodeVideo(this).showPreview()
        } else {
          useNodeImage(this).showPreview()
        }
      }

      // Nothing to do
      if (!this.imgs?.length) return

      if (this.animatedImages) {
        removeCanvasImagePreview(this)
        showAnimatedPreview(this)
      } else {
        removeAnimatedPreview(this)
        showCanvasImagePreview(this)
      }
    }

    node.prototype.onDrawBackground = function () {
      try {
        unsafeDrawBackground.call(this)
      } catch (error) {
        console.error('Error drawing node background', error)
      }
    }
  }

  function addNodeKeyHandler(node: typeof LGraphNode) {
    const origNodeOnKeyDown = node.prototype.onKeyDown

    node.prototype.onKeyDown = function (e) {
      // @ts-expect-error fixme ts strict error
      if (origNodeOnKeyDown && origNodeOnKeyDown.apply(this, e) === false) {
        return false
      }

      if (this.flags.collapsed || !this.imgs || this.imageIndex === null) {
        return
      }

      let handled = false

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.key === 'ArrowLeft') {
          // @ts-expect-error fixme ts strict error
          this.imageIndex -= 1
        } else if (e.key === 'ArrowRight') {
          // @ts-expect-error fixme ts strict error
          this.imageIndex += 1
        }
        // @ts-expect-error fixme ts strict error
        this.imageIndex %= this.imgs.length

        // @ts-expect-error fixme ts strict error
        if (this.imageIndex < 0) {
          // @ts-expect-error fixme ts strict error
          this.imageIndex = this.imgs.length + this.imageIndex
        }
        handled = true
      } else if (e.key === 'Escape') {
        this.imageIndex = null
        handled = true
      }

      if (handled === true) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }
    }
  }

  function addNodeOnGraph(
    nodeDef: ComfyNodeDefV1 | ComfyNodeDefV2,
    options: Record<string, any> = {}
  ): LGraphNode {
    options.pos ??= getCanvasCenter()

    const node = LiteGraph.createNode(
      nodeDef.name,
      nodeDef.display_name,
      options
    )

    const graph = useWorkflowStore().activeSubgraph ?? app.graph

    // @ts-expect-error fixme ts strict error
    graph.add(node)
    // @ts-expect-error fixme ts strict error
    return node
  }

  function getCanvasCenter(): Vector2 {
    const dpi = Math.max(window.devicePixelRatio ?? 1, 1)
    const [x, y, w, h] = app.canvas.ds.visible_area
    return [x + w / dpi / 2, y + h / dpi / 2]
  }

  function goToNode(nodeId: NodeId) {
    const graphNode = app.graph.getNodeById(nodeId)
    if (!graphNode) return
    app.canvas.animateToBounds(graphNode.boundingRect)
  }

  /**
   * Resets the canvas view to the default
   */
  function resetView() {
    const canvas = canvasStore.canvas
    if (!canvas) return

    canvas.ds.scale = 1
    canvas.ds.offset = [0, 0]
    canvas.setDirty(true, true)
  }

  function fitView() {
    const canvas = canvasStore.canvas
    if (!canvas) return

    const bounds = createBounds(app.graph.nodes)
    if (!bounds) return

    canvas.ds.fitToBounds(bounds)
    canvas.setDirty(true, true)
  }

  return {
    registerNodeDef,
    registerSubgraphNodeDef,
    addNodeOnGraph,
    getCanvasCenter,
    goToNode,
    resetView,
    fitView
  }
}
