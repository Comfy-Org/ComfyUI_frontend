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
import { IBaseWidget, IWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { st } from '@/i18n'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { ANIM_PREVIEW_WIDGET, ComfyApp, app } from '@/scripts/app'
import { $el } from '@/scripts/ui'
import { calculateImageGrid, createImageHost } from '@/scripts/ui/imagePreview'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useToastStore } from '@/stores/toastStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { is_all_same_aspect_ratio } from '@/utils/imageUtil'
import { getImageTop, isImageNode, isVideoNode } from '@/utils/litegraphUtil'

import { useExtensionService } from './extensionService'

/**
 * Service that augments litegraph with ComfyUI specific functionality.
 */
export const useLitegraphService = () => {
  const extensionService = useExtensionService()
  const toastStore = useToastStore()
  const canvasStore = useCanvasStore()

  async function registerNodeDef(nodeId: string, nodeData: ComfyNodeDef) {
    const node = class ComfyNode extends LGraphNode {
      static comfyClass? = nodeData.name
      // TODO: change to "title?" once litegraph.d.ts has been updated
      static title = nodeData.display_name || nodeData.name
      static nodeData? = nodeData
      static category?: string

      constructor(title?: string) {
        super(title)
        const requiredInputs = nodeData.input.required

        let inputs = nodeData['input']['required']
        if (nodeData['input']['optional'] != undefined) {
          inputs = Object.assign(
            {},
            nodeData['input']['required'],
            nodeData['input']['optional']
          )
        }
        const config: {
          minWidth: number
          minHeight: number
          widget?: IBaseWidget
        } = { minWidth: 1, minHeight: 1 }
        for (const inputName in inputs) {
          const _inputData = inputs[inputName]
          const type = _inputData[0]
          const options = _inputData[1] ?? {}
          const inputData = [type, options]
          const nameKey = `nodeDefs.${normalizeI18nKey(nodeData.name)}.inputs.${normalizeI18nKey(inputName)}.name`

          const inputIsRequired = requiredInputs && inputName in requiredInputs

          let widgetCreated = true
          const widgetType = app.getWidgetType(inputData, inputName)
          if (widgetType) {
            if (widgetType === 'COMBO') {
              Object.assign(
                config,
                app.widgets.COMBO(this, inputName, inputData, app) || {}
              )
            } else {
              Object.assign(
                config,
                app.widgets[widgetType](this, inputName, inputData, app) || {}
              )
            }
            if (config.widget) {
              const fallback = config.widget.label ?? inputName
              config.widget.label = st(nameKey, fallback)
            }
          } else {
            // Node connection inputs
            const shapeOptions = inputIsRequired
              ? {}
              : { shape: RenderShape.HollowCircle }
            const inputOptions = {
              ...shapeOptions,
              localized_name: st(nameKey, inputName)
            }
            this.addInput(inputName, type, inputOptions)
            widgetCreated = false
          }

          if (widgetCreated && config?.widget) {
            config.widget.options ??= {}
            if (!inputIsRequired) {
              config.widget.options.inputIsOptional = true
            }
            if (inputData[1]?.forceInput) {
              config.widget.options.forceInput = true
            }
            if (inputData[1]?.defaultInput) {
              config.widget.options.defaultInput = true
            }
            if (inputData[1]?.advanced) {
              config.widget.advanced = true
            }
            if (inputData[1]?.hidden) {
              config.widget.hidden = true
            }
          }
        }

        for (const o in nodeData['output']) {
          let output = nodeData['output'][o]
          if (output instanceof Array) output = 'COMBO'
          const outputName = nodeData['output_name'][o] || output
          const outputIsList = nodeData['output_is_list'][o]
          const shapeOptions = outputIsList
            ? { shape: LiteGraph.GRID_SHAPE }
            : {}
          const nameKey = `nodeDefs.${normalizeI18nKey(nodeData.name)}.outputs.${o}.name`
          const typeKey = `dataTypes.${normalizeI18nKey(output)}`
          const outputOptions = {
            ...shapeOptions,
            // If the output name is different from the output type, use the output name.
            // e.g.
            // - type ("INT"); name ("Positive") => translate name
            // - type ("FLOAT"); name ("FLOAT") => translate type
            localized_name:
              output !== outputName
                ? st(nameKey, outputName)
                : st(typeKey, outputName)
          }
          this.addOutput(outputName, output, outputOptions)
        }

        const s = this.computeSize()
        s[0] = Math.max(config.minWidth, s[0] * 1.5)
        s[1] = Math.max(config.minHeight, s[1])
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
    node.prototype.comfyClass = nodeData.name

    addNodeContextMenuHandler(node)
    addDrawBackgroundHandler(node)
    addNodeKeyHandler(node)

    await extensionService.invokeExtensionsAsync(
      'beforeRegisterNodeDef',
      node,
      nodeData
    )
    LiteGraph.registerNodeType(nodeId, node)
    // Note: Do not move this to the class definition, it will be overwritten
    node.category = nodeData.category
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
        callback: (obj) => {
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
          callback: (obj) => {
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
            callback: (obj) => {
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
    node.prototype.setSizeForImage = function (
      this: LGraphNode,
      force: boolean
    ) {
      if (!force && this.animatedImages) return

      if (this.inputHeight || this.freeWidgetSpace > 210) {
        this.setSize(this.size)
        return
      }
      const minHeight = getImageTop(this) + 220
      if (this.size[1] < minHeight) {
        this.setSize([this.size[0], minHeight])
      }
    }

    function unsafeDrawBackground(
      this: LGraphNode,
      ctx: CanvasRenderingContext2D
    ) {
      if (this.flags.collapsed) return

      const nodeOutputStore = useNodeOutputStore()

      const output = nodeOutputStore.getNodeOutputs(this)
      const preview = nodeOutputStore.getNodePreviews(this)

      const isNewOutput = output && this.images !== output.images
      const isNewPreview = preview && this.preview !== preview

      if (isNewPreview) this.preview = preview
      if (isNewOutput) this.images = output.images

      if (isNewOutput || isNewPreview) {
        this.animatedImages = output?.animated?.find(Boolean)

        if (this.animatedImages || isVideoNode(this)) {
          useNodeVideo(this).showPreview()
        } else {
          useNodeImage(this).showPreview()
        }
      }

      // Nothing to do
      if (!this.imgs?.length) return

      const widgetIdx = this.widgets?.findIndex(
        (w) => w.name === ANIM_PREVIEW_WIDGET
      )

      if (this.animatedImages) {
        // Instead of using the canvas we'll use a IMG
        if (widgetIdx > -1) {
          // Replace content
          const widget = this.widgets[widgetIdx] as IWidget & {
            options: { host: ReturnType<typeof createImageHost> }
          }
          widget.options.host.updateImages(this.imgs)
        } else {
          const host = createImageHost(this)
          this.setSizeForImage(true)
          const widget = this.addDOMWidget(
            ANIM_PREVIEW_WIDGET,
            'img',
            host.el,
            {
              host,
              // @ts-expect-error `getHeight` of image host returns void instead of number.
              getHeight: host.getHeight,
              onDraw: host.onDraw,
              hideOnZoom: false
            }
          ) as IWidget & {
            options: { host: ReturnType<typeof createImageHost> }
          }
          widget.serializeValue = () => undefined
          widget.options.host.updateImages(this.imgs)
        }
        return
      }

      if (widgetIdx > -1) {
        this.widgets[widgetIdx].onRemove?.()
        this.widgets.splice(widgetIdx, 1)
      }

      const canvas = app.graph.list_of_graphcanvas[0]
      const mouse = canvas.graph_mouse
      if (!canvas.pointer_is_down && this.pointerDown) {
        if (
          mouse[0] === this.pointerDown.pos[0] &&
          mouse[1] === this.pointerDown.pos[1]
        ) {
          this.imageIndex = this.pointerDown.index
        }
        this.pointerDown = null
      }

      let { imageIndex } = this
      const numImages = this.imgs.length
      if (numImages === 1 && !imageIndex) {
        // This skips the thumbnail render section below
        this.imageIndex = imageIndex = 0
      }

      const shiftY = getImageTop(this)

      const IMAGE_TEXT_SIZE_TEXT_HEIGHT = 15
      const dw = this.size[0]
      const dh = this.size[1] - shiftY - IMAGE_TEXT_SIZE_TEXT_HEIGHT

      if (imageIndex == null) {
        // No image selected; draw thumbnails of all
        let cellWidth: number
        let cellHeight: number
        let shiftX: number
        let cell_padding: number
        let cols: number

        const compact_mode = is_all_same_aspect_ratio(this.imgs)
        if (!compact_mode) {
          // use rectangle cell style and border line
          cell_padding = 2
          // Prevent infinite canvas2d scale-up
          const largestDimension = this.imgs.reduce(
            (acc, current) =>
              Math.max(acc, current.naturalWidth, current.naturalHeight),
            0
          )
          const fakeImgs = []
          fakeImgs.length = this.imgs.length
          fakeImgs[0] = {
            naturalWidth: largestDimension,
            naturalHeight: largestDimension
          }
          ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
            fakeImgs,
            dw,
            dh
          ))
        } else {
          cell_padding = 0
          ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
            this.imgs,
            dw,
            dh
          ))
        }

        let anyHovered = false
        this.imageRects = []
        for (let i = 0; i < numImages; i++) {
          const img = this.imgs[i]
          const row = Math.floor(i / cols)
          const col = i % cols
          const x = col * cellWidth + shiftX
          const y = row * cellHeight + shiftY
          if (!anyHovered) {
            anyHovered = LiteGraph.isInsideRectangle(
              mouse[0],
              mouse[1],
              x + this.pos[0],
              y + this.pos[1],
              cellWidth,
              cellHeight
            )
            if (anyHovered) {
              this.overIndex = i
              let value = 110
              if (canvas.pointer_is_down) {
                if (!this.pointerDown || this.pointerDown.index !== i) {
                  this.pointerDown = { index: i, pos: [...mouse] }
                }
                value = 125
              }
              ctx.filter = `contrast(${value}%) brightness(${value}%)`
              canvas.canvas.style.cursor = 'pointer'
            }
          }
          this.imageRects.push([x, y, cellWidth, cellHeight])

          const wratio = cellWidth / img.width
          const hratio = cellHeight / img.height
          const ratio = Math.min(wratio, hratio)

          const imgHeight = ratio * img.height
          const imgY = row * cellHeight + shiftY + (cellHeight - imgHeight) / 2
          const imgWidth = ratio * img.width
          const imgX = col * cellWidth + shiftX + (cellWidth - imgWidth) / 2

          ctx.drawImage(
            img,
            imgX + cell_padding,
            imgY + cell_padding,
            imgWidth - cell_padding * 2,
            imgHeight - cell_padding * 2
          )
          if (!compact_mode) {
            // rectangle cell and border line style
            ctx.strokeStyle = '#8F8F8F'
            ctx.lineWidth = 1
            ctx.strokeRect(
              x + cell_padding,
              y + cell_padding,
              cellWidth - cell_padding * 2,
              cellHeight - cell_padding * 2
            )
          }

          ctx.filter = 'none'
        }

        if (!anyHovered) {
          this.pointerDown = null
          this.overIndex = null
        }

        return
      }
      // Draw individual
      const img = this.imgs[imageIndex]
      let w = img.naturalWidth
      let h = img.naturalHeight

      const scaleX = dw / w
      const scaleY = dh / h
      const scale = Math.min(scaleX, scaleY, 1)

      w *= scale
      h *= scale

      const x = (dw - w) / 2
      const y = (dh - h) / 2 + shiftY
      ctx.drawImage(img, x, y, w, h)

      // Draw image size text below the image
      ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR
      ctx.textAlign = 'center'
      const sizeText = `${Math.round(img.naturalWidth)} × ${Math.round(img.naturalHeight)}`
      const textY = y + h + 10
      ctx.fillText(sizeText, x + w / 2, textY)

      const drawButton = (
        x: number,
        y: number,
        sz: number,
        text: string
      ): boolean => {
        const hovered = LiteGraph.isInsideRectangle(
          mouse[0],
          mouse[1],
          x + this.pos[0],
          y + this.pos[1],
          sz,
          sz
        )
        let fill = '#333'
        let textFill = '#fff'
        let isClicking = false
        if (hovered) {
          canvas.canvas.style.cursor = 'pointer'
          if (canvas.pointer_is_down) {
            fill = '#1e90ff'
            isClicking = true
          } else {
            fill = '#eee'
            textFill = '#000'
          }
        }

        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.roundRect(x, y, sz, sz, [4])
        ctx.fill()
        ctx.fillStyle = textFill
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(text, x + 15, y + 20)

        return isClicking
      }

      if (!(numImages > 1)) return

      const imageNum = this.imageIndex + 1
      if (
        drawButton(dw - 40, dh + shiftY - 40, 30, `${imageNum}/${numImages}`)
      ) {
        const i = imageNum >= numImages ? 0 : imageNum
        if (!this.pointerDown || this.pointerDown.index !== i) {
          this.pointerDown = { index: i, pos: [...mouse] }
        }
      }

      if (drawButton(dw - 40, shiftY + 10, 30, `x`)) {
        if (!this.pointerDown || this.pointerDown.index !== null) {
          this.pointerDown = { index: null, pos: [...mouse] }
        }
      }
    }

    node.prototype.onDrawBackground = function (ctx) {
      try {
        unsafeDrawBackground.call(this, ctx)
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
    nodeDef: ComfyNodeDef,
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
