// @ts-strict-ignore
import {
  type IContextMenuValue,
  type INodeInputSlot,
  LGraphEventMode,
  LGraphNode,
  LiteGraph,
  RenderShape
} from '@comfyorg/litegraph'
import { Vector2 } from '@comfyorg/litegraph'

import { useNodeAnimatedImage } from '@/composables/node/useNodeAnimatedImage'
import { useNodeCanvasImagePreview } from '@/composables/node/useNodeCanvasImagePreview'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { st } from '@/i18n'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyApp, app } from '@/scripts/app'
import { $el } from '@/scripts/ui'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useToastStore } from '@/stores/toastStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { isImageNode, isVideoNode } from '@/utils/litegraphUtil'

import { useExtensionService } from './extensionService'

/**
 * Service that augments litegraph with ComfyUI specific functionality.
 */
export const useLitegraphService = () => {
  const extensionService = useExtensionService()
  const toastStore = useToastStore()
  const widgetStore = useWidgetStore()
  const canvasStore = useCanvasStore()

  async function registerNodeDef(nodeId: string, nodeDefV1: ComfyNodeDefV1) {
    const node = class ComfyNode extends LGraphNode {
      static comfyClass?: string
      static title?: string
      static nodeData?: ComfyNodeDefV1 & ComfyNodeDefV2
      static category?: string

      constructor(title?: string) {
        super(title)

        const nodeMinSize = { width: 1, height: 1 }
        // Process inputs using V2 schema
        for (const [inputName, inputSpec] of Object.entries(nodeDef.inputs)) {
          const inputType = inputSpec.type
          const nameKey = `nodeDefs.${normalizeI18nKey(nodeDef.name)}.inputs.${normalizeI18nKey(inputName)}.name`

          const widgetConstructor = widgetStore.widgets[inputType]
          if (widgetConstructor) {
            const {
              widget,
              minWidth = 1,
              minHeight = 1
            } = widgetConstructor(
              this,
              inputName,
              transformInputSpecV2ToV1(inputSpec),
              app
            ) ?? {}

            if (widget) {
              const fallback = widget.label ?? inputName
              widget.label = st(nameKey, fallback)

              widget.options ??= {}
              if (inputSpec.isOptional) {
                widget.options.inputIsOptional = true
              }
              if (inputSpec.forceInput) {
                widget.options.forceInput = true
              }
              if (inputSpec.defaultInput) {
                widget.options.defaultInput = true
              }
              if (inputSpec.advanced) {
                widget.advanced = true
              }
              if (inputSpec.hidden) {
                widget.hidden = true
              }
            }

            nodeMinSize.width = Math.max(nodeMinSize.width, minWidth)
            nodeMinSize.height = Math.max(nodeMinSize.height, minHeight)
          } else {
            // Node connection inputs
            const shapeOptions = inputSpec.isOptional
              ? { shape: RenderShape.HollowCircle }
              : {}

            this.addInput(inputName, inputType, {
              ...shapeOptions,
              localized_name: st(nameKey, inputName)
            })
          }
        }

        // Process outputs using V2 schema
        for (const output of nodeDef.outputs) {
          const outputName = output.name
          const outputType = output.type
          const outputIsList = output.is_list
          const shapeOptions = outputIsList
            ? { shape: LiteGraph.GRID_SHAPE }
            : {}
          const nameKey = `nodeDefs.${normalizeI18nKey(nodeDef.name)}.outputs.${output.index}.name`
          const typeKey = `dataTypes.${normalizeI18nKey(outputType)}`
          const outputOptions = {
            ...shapeOptions,
            // If the output name is different from the output type, use the output name.
            // e.g.
            // - type ("INT"); name ("Positive") => translate name
            // - type ("FLOAT"); name ("FLOAT") => translate type
            localized_name:
              outputType !== outputName
                ? st(nameKey, outputName)
                : st(typeKey, outputName)
          }
          this.addOutput(outputName, outputType, outputOptions)
        }

        const s = this.computeSize()
        s[0] = Math.max(nodeMinSize.width, s[0] * 1.5)
        s[1] = Math.max(nodeMinSize.height, s[1])
        this.setSize(s)
        this.serialize_widgets = true

        extensionService.invokeExtensionsAsync('nodeCreated', this)
      }

      configure(data: any) {
        // Keep 'name', 'type', 'shape', and 'localized_name' information from the original node definition.
        const merge = (
          current: Record<string, any>,
          incoming: Record<string, any>
        ) => {
          const result = { ...incoming }
          if (current.widget === undefined && incoming.widget !== undefined) {
            // Field must be input as only inputs can be converted
            this.inputs.push(current as INodeInputSlot)
            return incoming
          }
          for (const key of ['name', 'type', 'shape', 'localized_name']) {
            if (current[key] !== undefined) {
              result[key] = current[key]
            }
          }
          return result
        }
        for (const field of ['inputs', 'outputs']) {
          const slots = data[field] ?? []
          data[field] = slots.map((slot, i) =>
            merge(this[field][i] ?? {}, slot)
          )
        }
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
                  let image
                  if (typeof window.createImageBitmap === 'undefined') {
                    image = new Image()
                    const p = new Promise((resolve, reject) => {
                      image.onload = resolve
                      image.onerror = reject
                    }).finally(() => {
                      URL.revokeObjectURL(image.src)
                    })
                    image.src = URL.createObjectURL(blob)
                    await p
                  } else {
                    image = await createImageBitmap(blob)
                  }
                  try {
                    ctx.drawImage(image, 0, 0)
                    canvas.toBlob(writeImage, 'image/png')
                  } finally {
                    if (typeof image.close === 'function') {
                      image.close()
                    }
                  }

                  return
                }
                throw error
              }
            } catch (error) {
              toastStore.addAlert(
                'Error copying image: ' + (error.message ?? error)
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
            content: 'Open in MaskEditor',
            callback: () => {
              ComfyApp.copyToClipspace(this)
              ComfyApp.clipspace_return_node = this
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
      if (origNodeOnKeyDown && origNodeOnKeyDown.apply(this, e) === false) {
        return false
      }

      if (this.flags.collapsed || !this.imgs || this.imageIndex === null) {
        return
      }

      let handled = false

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.key === 'ArrowLeft') {
          this.imageIndex -= 1
        } else if (e.key === 'ArrowRight') {
          this.imageIndex += 1
        }
        this.imageIndex %= this.imgs.length

        if (this.imageIndex < 0) {
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

    app.graph.add(node)
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

  return {
    registerNodeDef,
    addNodeOnGraph,
    getCanvasCenter,
    goToNode,
    resetView
  }
}
