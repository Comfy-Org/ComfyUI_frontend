// @ts-strict-ignore
import {
  type ComfyWidgetConstructor,
  ComfyWidgets,
  initWidgets
} from './widgets'
import { ComfyUI, $el } from './ui'
import { api, type ComfyApi } from './api'
import { defaultGraph } from './defaultGraph'
import {
  getPngMetadata,
  getWebpMetadata,
  getFlacMetadata,
  importA1111,
  getLatentMetadata
} from './pnginfo'
import { createImageHost, calculateImageGrid } from './ui/imagePreview'
import type { ComfyExtension, MissingNodeType } from '@/types/comfy'
import {
  type ComfyWorkflowJSON,
  type NodeId,
  validateComfyWorkflow
} from '@/types/comfyWorkflow'
import type { ComfyNodeDef } from '@/types/apiTypes'
import { adjustColor, ColorAdjustOptions } from '@/utils/colorUtil'
import { ComfyAppMenu } from './ui/menu/index'
import { getStorageValue } from './utils'
import { ComfyWorkflow } from '@/stores/workflowStore'
import {
  LGraphCanvas,
  LGraph,
  LGraphNode,
  LiteGraph,
  LGraphEventMode
} from '@comfyorg/litegraph'
import { ExtensionManager } from '@/types/extensionTypes'
import {
  ComfyNodeDefImpl,
  SYSTEM_NODE_DEFS,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import { INodeInputSlot, Vector2 } from '@comfyorg/litegraph'
import _ from 'lodash'
import {
  showExecutionErrorDialog,
  showLoadWorkflowWarning,
  showMissingModelsWarning
} from '@/services/dialogService'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useModelStore } from '@/stores/modelStore'
import type { ToastMessageOptions } from 'primevue/toast'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useExecutionStore } from '@/stores/executionStore'
import { IWidget } from '@comfyorg/litegraph'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeyComboImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'
import { shallowReactive } from 'vue'
import { type IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { workflowService } from '@/services/workflowService'
import { useWidgetStore } from '@/stores/widgetStore'
import { deserialiseAndCreate } from '@/extensions/core/vintageClipboard'
import { st } from '@/i18n'

export const ANIM_PREVIEW_WIDGET = '$$comfy_animation_preview'

function sanitizeNodeName(string) {
  let entityMap = {
    '&': '',
    '<': '',
    '>': '',
    '"': '',
    "'": '',
    '`': '',
    '=': ''
  }
  return String(string).replace(/[&<>"'`=]/g, function fromEntityMap(s) {
    return entityMap[s]
  })
}

type Clipspace = {
  widgets?: { type?: string; name?: string; value?: any }[] | null
  imgs?: HTMLImageElement[] | null
  original_imgs?: HTMLImageElement[] | null
  images?: any[] | null
  selectedIndex: number
  img_paste_mode: string
}

/**
 * @typedef {import("types/comfy").ComfyExtension} ComfyExtension
 */

export class ComfyApp {
  /**
   * List of entries to queue
   * @type {{number: number, batchCount: number}[]}
   */
  #queueItems = []
  /**
   * If the queue is currently being processed
   * @type {boolean}
   */
  #processingQueue = false

  /**
   * Content Clipboard
   * @type {serialized node object}
   */
  static clipspace: Clipspace | null = null
  static clipspace_invalidate_handler: (() => void) | null = null
  static open_maskeditor = null
  static clipspace_return_node = null

  vueAppReady: boolean
  api: ComfyApi
  ui: ComfyUI
  extensions: ComfyExtension[]
  extensionManager: ExtensionManager
  _nodeOutputs: Record<string, any>
  nodePreviewImages: Record<string, typeof Image>
  graph: LGraph
  canvas: LGraphCanvas
  dragOverNode: LGraphNode | null
  canvasEl: HTMLCanvasElement
  // x, y, scale
  zoom_drag_start: [number, number, number] | null
  lastNodeErrors: any[] | null
  /** @type {ExecutionErrorWsMessage} */
  lastExecutionError: { node_id?: NodeId } | null
  /** @type {ProgressWsMessage} */
  progress: { value?: number; max?: number } | null
  configuringGraph: boolean
  ctx: CanvasRenderingContext2D
  bodyTop: HTMLElement
  bodyLeft: HTMLElement
  bodyRight: HTMLElement
  bodyBottom: HTMLElement
  canvasContainer: HTMLElement
  menu: ComfyAppMenu
  bypassBgColor: string
  // Set by Comfy.Clipspace extension
  openClipspace: () => void = () => {}

  /**
   * @deprecated Use useExecutionStore().executingNodeId instead
   */
  get runningNodeId(): string | null {
    return useExecutionStore().executingNodeId
  }

  /**
   * @deprecated Use useWorkspaceStore().shiftDown instead
   */
  get shiftDown(): boolean {
    return useWorkspaceStore().shiftDown
  }

  /**
   * @deprecated Use useWidgetStore().widgets instead
   */
  get widgets(): Record<string, ComfyWidgetConstructor> {
    if (this.vueAppReady) {
      return useWidgetStore().widgets
    }
    return ComfyWidgets
  }

  /**
   * @deprecated storageLocation is always 'server' since
   * https://github.com/comfyanonymous/ComfyUI/commit/53c8a99e6c00b5e20425100f6680cd9ea2652218
   */
  get storageLocation() {
    return 'server'
  }

  /**
   * @deprecated storage migration is no longer needed.
   */
  get isNewUserSession() {
    return false
  }

  constructor() {
    this.vueAppReady = false
    this.ui = new ComfyUI(this)
    this.api = api
    this.bodyTop = $el('div.comfyui-body-top', { parent: document.body })
    this.bodyLeft = $el('div.comfyui-body-left', { parent: document.body })
    this.bodyRight = $el('div.comfyui-body-right', { parent: document.body })
    this.bodyBottom = $el('div.comfyui-body-bottom', { parent: document.body })
    this.canvasContainer = $el('div.graph-canvas-container', {
      parent: document.body
    })
    this.menu = new ComfyAppMenu(this)
    this.bypassBgColor = '#FF00FF'

    /**
     * List of extensions that are registered with the app
     * @type {ComfyExtension[]}
     */
    this.extensions = []

    /**
     * Stores the execution output data for each node
     * @type {Record<string, any>}
     */
    this.nodeOutputs = {}

    /**
     * Stores the preview image data for each node
     * @type {Record<string, Image>}
     */
    this.nodePreviewImages = {}
  }

  get nodeOutputs() {
    return this._nodeOutputs
  }

  set nodeOutputs(value) {
    this._nodeOutputs = value
    this.#invokeExtensions('onNodeOutputsUpdated', value)
  }

  getPreviewFormatParam() {
    let preview_format = this.ui.settings.getSettingValue('Comfy.PreviewFormat')
    if (preview_format) return `&preview=${preview_format}`
    else return ''
  }

  getRandParam() {
    return '&rand=' + Math.random()
  }

  static isImageNode(node) {
    return (
      node.imgs ||
      (node &&
        node.widgets &&
        node.widgets.findIndex((obj) => obj.name === 'image') >= 0)
    )
  }

  static onClipspaceEditorSave() {
    if (ComfyApp.clipspace_return_node) {
      ComfyApp.pasteFromClipspace(ComfyApp.clipspace_return_node)
    }
  }

  static onClipspaceEditorClosed() {
    ComfyApp.clipspace_return_node = null
  }

  static copyToClipspace(node) {
    var widgets = null
    if (node.widgets) {
      widgets = node.widgets.map(({ type, name, value }) => ({
        type,
        name,
        value
      }))
    }

    var imgs = undefined
    var orig_imgs = undefined
    if (node.imgs != undefined) {
      imgs = []
      orig_imgs = []

      for (let i = 0; i < node.imgs.length; i++) {
        imgs[i] = new Image()
        imgs[i].src = node.imgs[i].src
        orig_imgs[i] = imgs[i]
      }
    }

    var selectedIndex = 0
    if (node.imageIndex) {
      selectedIndex = node.imageIndex
    }

    ComfyApp.clipspace = {
      widgets: widgets,
      imgs: imgs,
      original_imgs: orig_imgs,
      images: node.images,
      selectedIndex: selectedIndex,
      img_paste_mode: 'selected' // reset to default im_paste_mode state on copy action
    }

    ComfyApp.clipspace_return_node = null

    if (ComfyApp.clipspace_invalidate_handler) {
      ComfyApp.clipspace_invalidate_handler()
    }
  }

  static pasteFromClipspace(node) {
    if (ComfyApp.clipspace) {
      // image paste
      if (ComfyApp.clipspace.imgs && node.imgs) {
        if (node.images && ComfyApp.clipspace.images) {
          if (ComfyApp.clipspace['img_paste_mode'] == 'selected') {
            node.images = [
              ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']]
            ]
          } else {
            node.images = ComfyApp.clipspace.images
          }

          if (app.nodeOutputs[node.id + ''])
            app.nodeOutputs[node.id + ''].images = node.images
        }

        if (ComfyApp.clipspace.imgs) {
          // deep-copy to cut link with clipspace
          if (ComfyApp.clipspace['img_paste_mode'] == 'selected') {
            const img = new Image()
            img.src =
              ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
            node.imgs = [img]
            node.imageIndex = 0
          } else {
            const imgs = []
            for (let i = 0; i < ComfyApp.clipspace.imgs.length; i++) {
              imgs[i] = new Image()
              imgs[i].src = ComfyApp.clipspace.imgs[i].src
              node.imgs = imgs
            }
          }
        }
      }

      if (node.widgets) {
        if (ComfyApp.clipspace.images) {
          const clip_image =
            ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']]
          const index = node.widgets.findIndex((obj) => obj.name === 'image')
          if (index >= 0) {
            if (
              node.widgets[index].type != 'image' &&
              typeof node.widgets[index].value == 'string' &&
              clip_image.filename
            ) {
              node.widgets[index].value =
                (clip_image.subfolder ? clip_image.subfolder + '/' : '') +
                clip_image.filename +
                (clip_image.type ? ` [${clip_image.type}]` : '')
            } else {
              node.widgets[index].value = clip_image
            }
          }
        }
        if (ComfyApp.clipspace.widgets) {
          ComfyApp.clipspace.widgets.forEach(({ type, name, value }) => {
            const prop = Object.values(node.widgets).find(
              // @ts-expect-errorg
              (obj) => obj.type === type && obj.name === name
            )
            // @ts-expect-error
            if (prop && prop.type != 'button') {
              if (
                // @ts-expect-error
                prop.type != 'image' &&
                // @ts-expect-error
                typeof prop.value == 'string' &&
                value.filename
              ) {
                // @ts-expect-error
                prop.value =
                  (value.subfolder ? value.subfolder + '/' : '') +
                  value.filename +
                  (value.type ? ` [${value.type}]` : '')
              } else {
                // @ts-expect-error
                prop.value = value
                // @ts-expect-error
                prop.callback(value)
              }
            }
          })
        }
      }

      app.graph.setDirtyCanvas(true)
    }
  }

  get enabledExtensions() {
    if (!this.vueAppReady) {
      return this.extensions
    }
    return useExtensionStore().enabledExtensions
  }

  /**
   * Invoke an extension callback
   * @param {keyof ComfyExtension} method The extension callback to execute
   * @param  {any[]} args Any arguments to pass to the callback
   * @returns
   */
  #invokeExtensions(method, ...args) {
    let results = []
    for (const ext of this.enabledExtensions) {
      if (method in ext) {
        try {
          results.push(ext[method](...args, this))
        } catch (error) {
          console.error(
            `Error calling extension '${ext.name}' method '${method}'`,
            { error },
            { extension: ext },
            { args }
          )
        }
      }
    }
    return results
  }

  /**
   * Invoke an async extension callback
   * Each callback will be invoked concurrently
   * @param {string} method The extension callback to execute
   * @param  {...any} args Any arguments to pass to the callback
   * @returns
   */
  async #invokeExtensionsAsync(method, ...args) {
    return await Promise.all(
      this.enabledExtensions.map(async (ext) => {
        if (method in ext) {
          try {
            return await ext[method](...args, this)
          } catch (error) {
            console.error(
              `Error calling extension '${ext.name}' method '${method}'`,
              { error },
              { extension: ext },
              { args }
            )
          }
        }
      })
    )
  }

  #addRestoreWorkflowView() {
    const serialize = LGraph.prototype.serialize
    const self = this
    LGraph.prototype.serialize = function () {
      const workflow = serialize.apply(this, arguments)

      // Store the drag & scale info in the serialized workflow if the setting is enabled
      if (useSettingStore().get('Comfy.EnableWorkflowViewRestore')) {
        if (!workflow.extra) {
          workflow.extra = {}
        }
        workflow.extra.ds = {
          scale: self.canvas.ds.scale,
          offset: self.canvas.ds.offset
        }
      } else if (workflow.extra?.ds) {
        // Clear any old view data
        delete workflow.extra.ds
      }

      return workflow
    }
  }

  /**
   * Adds special context menu handling for nodes
   * e.g. this adds Open Image functionality for nodes that show images
   * @param {*} node The node to add the menu handler
   */
  #addNodeContextMenuHandler(node) {
    function getCopyImageOption(img) {
      if (typeof window.ClipboardItem === 'undefined') return []
      return [
        {
          content: 'Copy Image',
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
              useToastStore().addAlert(
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
                let url = new URL(img.src)
                url.searchParams.delete('preview')
                window.open(url, '_blank')
              }
            },
            ...getCopyImageOption(img),
            {
              content: 'Save Image',
              callback: () => {
                const a = document.createElement('a')
                let url = new URL(img.src)
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
          if (this.mode === LGraphEventMode.BYPASS)
            this.mode = LGraphEventMode.ALWAYS
          else this.mode = LGraphEventMode.BYPASS
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

        if (ComfyApp.isImageNode(this)) {
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
    }
  }

  #addNodeKeyHandler(node) {
    const app = this
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

  /**
   * Adds Custom drawing logic for nodes
   * e.g. Draws images and handles thumbnail navigation on nodes that output images
   * @param {*} node The node to add the draw handler
   */
  #addDrawBackgroundHandler(node) {
    const app = this

    function getImageTop(node) {
      let shiftY
      if (node.imageOffset != null) {
        shiftY = node.imageOffset
      } else {
        if (node.widgets?.length) {
          const w = node.widgets[node.widgets.length - 1]
          shiftY = w.last_y
          if (w.computeSize) {
            shiftY += w.computeSize()[1] + 4
          } else if (w.computedHeight) {
            shiftY += w.computedHeight
          } else {
            shiftY += LiteGraph.NODE_WIDGET_HEIGHT + 4
          }
        } else {
          shiftY = node.computeSize()[1]
        }
      }
      return shiftY
    }

    node.prototype.setSizeForImage = function (force) {
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

    function unsafeDrawBackground(ctx) {
      if (!this.flags.collapsed) {
        let imgURLs = []
        let imagesChanged = false

        const output = app.nodeOutputs[this.id + '']
        if (output?.images) {
          this.animatedImages = output?.animated?.find(Boolean)
          if (this.images !== output.images) {
            this.images = output.images
            imagesChanged = true
            imgURLs = imgURLs.concat(
              output.images.map((params) => {
                return api.apiURL(
                  '/view?' +
                    new URLSearchParams(params).toString() +
                    (this.animatedImages ? '' : app.getPreviewFormatParam()) +
                    app.getRandParam()
                )
              })
            )
          }
        }

        const preview = app.nodePreviewImages[this.id + '']
        if (this.preview !== preview) {
          this.preview = preview
          imagesChanged = true
          if (preview != null) {
            imgURLs.push(preview)
          }
        }

        if (imagesChanged) {
          this.imageIndex = null
          if (imgURLs.length > 0) {
            Promise.all(
              imgURLs.map((src) => {
                return new Promise((r) => {
                  const img = new Image()
                  img.onload = () => r(img)
                  img.onerror = () => r(null)
                  img.src = src
                })
              })
            ).then((imgs) => {
              if (
                (!output || this.images === output.images) &&
                (!preview || this.preview === preview)
              ) {
                this.imgs = imgs.filter(Boolean)
                this.setSizeForImage?.()
                app.graph.setDirtyCanvas(true)
              }
            })
          } else {
            this.imgs = null
          }
        }

        const is_all_same_aspect_ratio = (imgs) => {
          // assume: imgs.length >= 2
          let ratio = imgs[0].naturalWidth / imgs[0].naturalHeight

          for (let i = 1; i < imgs.length; i++) {
            let this_ratio = imgs[i].naturalWidth / imgs[i].naturalHeight
            if (ratio != this_ratio) return false
          }

          return true
        }

        if (this.imgs?.length) {
          const widgetIdx = this.widgets?.findIndex(
            (w) => w.name === ANIM_PREVIEW_WIDGET
          )

          if (this.animatedImages) {
            // Instead of using the canvas we'll use a IMG
            if (widgetIdx > -1) {
              // Replace content
              const widget = this.widgets[widgetIdx]
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
                  getHeight: host.getHeight,
                  onDraw: host.onDraw,
                  hideOnZoom: false
                }
              )
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

          let imageIndex = this.imageIndex
          const numImages = this.imgs.length
          if (numImages === 1 && !imageIndex) {
            this.imageIndex = imageIndex = 0
          }

          const top = getImageTop(this)
          var shiftY = top

          let dw = this.size[0]
          let dh = this.size[1]
          dh -= shiftY

          if (imageIndex == null) {
            var cellWidth, cellHeight, shiftX, cell_padding, cols

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

              let wratio = cellWidth / img.width
              let hratio = cellHeight / img.height
              var ratio = Math.min(wratio, hratio)

              let imgHeight = ratio * img.height
              let imgY =
                row * cellHeight + shiftY + (cellHeight - imgHeight) / 2
              let imgWidth = ratio * img.width
              let imgX = col * cellWidth + shiftX + (cellWidth - imgWidth) / 2

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
          } else {
            // Draw individual
            let w = this.imgs[imageIndex].naturalWidth
            let h = this.imgs[imageIndex].naturalHeight

            const scaleX = dw / w
            const scaleY = dh / h
            const scale = Math.min(scaleX, scaleY, 1)

            w *= scale
            h *= scale

            let x = (dw - w) / 2
            let y = (dh - h) / 2 + shiftY
            ctx.drawImage(this.imgs[imageIndex], x, y, w, h)

            const drawButton = (x, y, sz, text) => {
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
              } else {
                this.pointerWasDown = null
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

            if (numImages > 1) {
              if (
                drawButton(
                  dw - 40,
                  dh + top - 40,
                  30,
                  `${this.imageIndex + 1}/${numImages}`
                )
              ) {
                let i =
                  this.imageIndex + 1 >= numImages ? 0 : this.imageIndex + 1
                if (!this.pointerDown || !this.pointerDown.index === i) {
                  this.pointerDown = { index: i, pos: [...mouse] }
                }
              }

              if (drawButton(dw - 40, top + 10, 30, `x`)) {
                if (!this.pointerDown || !this.pointerDown.index === null) {
                  this.pointerDown = { index: null, pos: [...mouse] }
                }
              }
            }
          }
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

  /**
   * Adds a handler allowing drag+drop of files onto the window to load workflows
   */
  #addDropHandler() {
    // Get prompt from dropped PNG or json
    document.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      const n = this.dragOverNode
      this.dragOverNode = null
      // Node handles file drop, we dont use the built in onDropFile handler as its buggy
      // If you drag multiple files it will call it multiple times with the same file
      // @ts-expect-error This is not a standard event. TODO fix it.
      if (n && n.onDragDrop && (await n.onDragDrop(event))) {
        return
      }
      // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
      if (
        event.dataTransfer.files.length &&
        event.dataTransfer.files[0].type !== 'image/bmp'
      ) {
        await this.handleFile(event.dataTransfer.files[0])
      } else {
        // Try loading the first URI in the transfer list
        const validTypes = ['text/uri-list', 'text/x-moz-url']
        const match = [...event.dataTransfer.types].find((t) =>
          validTypes.find((v) => t === v)
        )
        if (match) {
          const uri = event.dataTransfer.getData(match)?.split('\n')?.[0]
          if (uri) {
            await this.handleFile(await (await fetch(uri)).blob())
          }
        }
      }
    })

    // Always clear over node on drag leave
    this.canvasEl.addEventListener('dragleave', async () => {
      if (this.dragOverNode) {
        this.dragOverNode = null
        this.graph.setDirtyCanvas(false, true)
      }
    })

    // Add handler for dropping onto a specific node
    this.canvasEl.addEventListener(
      'dragover',
      (e) => {
        this.canvas.adjustMouseEvent(e)
        const node = this.graph.getNodeOnPos(e.canvasX, e.canvasY)
        if (node) {
          // @ts-expect-error This is not a standard event. TODO fix it.
          if (node.onDragOver && node.onDragOver(e)) {
            this.dragOverNode = node

            // dragover event is fired very frequently, run this on an animation frame
            requestAnimationFrame(() => {
              this.graph.setDirtyCanvas(false, true)
            })
            return
          }
        }
        this.dragOverNode = null
      },
      false
    )
  }

  /**
   * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
   */
  #addPasteHandler() {
    document.addEventListener('paste', async (e: ClipboardEvent) => {
      // ctrl+shift+v is used to paste nodes with connections
      // this is handled by litegraph
      if (this.shiftDown) return

      // @ts-expect-error: Property 'clipboardData' does not exist on type 'Window & typeof globalThis'.
      // Did you mean 'Clipboard'?ts(2551)
      // TODO: Not sure what the code wants to do.
      let data = e.clipboardData || window.clipboardData
      const items = data.items

      // Look for image paste data
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          var imageNode = null

          // If an image node is selected, paste into it
          if (
            this.canvas.current_node &&
            this.canvas.current_node.is_selected &&
            ComfyApp.isImageNode(this.canvas.current_node)
          ) {
            imageNode = this.canvas.current_node
          }

          // No image node selected: add a new one
          if (!imageNode) {
            const newNode = LiteGraph.createNode('LoadImage')
            // @ts-expect-error array to Float32Array
            newNode.pos = [...this.canvas.graph_mouse]
            imageNode = this.graph.add(newNode)
            this.graph.change()
          }
          const blob = item.getAsFile()
          imageNode.pasteFile(blob)
          return
        }
      }

      // No image found. Look for node data
      data = data.getData('text/plain')
      let workflow: ComfyWorkflowJSON | null = null
      try {
        data = data.slice(data.indexOf('{'))
        workflow = JSON.parse(data)
      } catch (err) {
        try {
          data = data.slice(data.indexOf('workflow\n'))
          data = data.slice(data.indexOf('{'))
          workflow = JSON.parse(data)
        } catch (error) {
          workflow = null
        }
      }

      if (workflow && workflow.version && workflow.nodes && workflow.extra) {
        await this.loadGraphData(workflow)
      } else {
        if (
          (e.target instanceof HTMLTextAreaElement &&
            e.target.type === 'textarea') ||
          (e.target instanceof HTMLInputElement && e.target.type === 'text')
        ) {
          return
        }

        // Litegraph default paste
        this.canvas.pasteFromClipboard()
      }
    })
  }

  /**
   * Adds a handler on copy that serializes selected nodes to JSON
   */
  #addCopyHandler() {
    document.addEventListener('copy', (e) => {
      if (!(e.target instanceof Element)) {
        return
      }
      if (
        (e.target instanceof HTMLTextAreaElement &&
          e.target.type === 'textarea') ||
        (e.target instanceof HTMLInputElement && e.target.type === 'text')
      ) {
        // Default system copy
        return
      }
      const isTargetInGraph =
        e.target.classList.contains('litegraph') ||
        e.target.classList.contains('graph-canvas-container')

      // copy nodes and clear clipboard
      if (isTargetInGraph && this.canvas.selected_nodes) {
        this.canvas.copyToClipboard()
        e.clipboardData.setData('text', ' ') //clearData doesn't remove images from clipboard
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }
    })
  }

  /**
   * Handle mouse
   *
   * Move group by header
   */
  #addProcessMouseHandler() {
    const self = this

    const origProcessMouseDown = LGraphCanvas.prototype.processMouseDown
    LGraphCanvas.prototype.processMouseDown = function (e) {
      // prepare for ctrl+shift drag: zoom start
      const useFastZoom = useSettingStore().get('Comfy.Graph.CtrlShiftZoom')
      if (useFastZoom && e.ctrlKey && e.shiftKey && !e.altKey && e.buttons) {
        self.zoom_drag_start = [e.x, e.y, this.ds.scale]
        return
      }

      const res = origProcessMouseDown.apply(this, arguments)
      return res
    }
    const origProcessMouseMove = LGraphCanvas.prototype.processMouseMove
    LGraphCanvas.prototype.processMouseMove = function (e) {
      // handle ctrl+shift drag
      if (e.ctrlKey && e.shiftKey && self.zoom_drag_start) {
        // stop canvas zoom action
        if (!e.buttons) {
          self.zoom_drag_start = null
          return
        }

        // calculate delta
        let deltaY = e.y - self.zoom_drag_start[1]
        let startScale = self.zoom_drag_start[2]

        let scale = startScale - deltaY / 100

        this.ds.changeScale(scale, [
          self.zoom_drag_start[0],
          self.zoom_drag_start[1]
        ])
        this.graph.change()

        return
      }

      return origProcessMouseMove.apply(this, arguments)
    }
  }

  /**
   * Handle keypress
   */
  #addProcessKeyHandler() {
    const origProcessKey = LGraphCanvas.prototype.processKey
    LGraphCanvas.prototype.processKey = function (e: KeyboardEvent) {
      if (!this.graph) {
        return
      }

      var block_default = false

      if (e.target instanceof Element && e.target.localName == 'input') {
        return
      }

      if (e.type == 'keydown' && !e.repeat) {
        const keyCombo = KeyComboImpl.fromEvent(e)
        const keybindingStore = useKeybindingStore()
        const keybinding = keybindingStore.getKeybinding(keyCombo)
        if (keybinding && keybinding.targetSelector === '#graph-canvas') {
          useCommandStore().execute(keybinding.commandId)
          block_default = true
        }

        // Ctrl+C Copy
        if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
          // Trigger onCopy
          return true
        }

        // Ctrl+V Paste
        if (
          (e.key === 'v' || e.key == 'V') &&
          (e.metaKey || e.ctrlKey) &&
          !e.shiftKey
        ) {
          // Trigger onPaste
          return true
        }
      }

      this.graph.change()

      if (block_default) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }

      // Fall through to Litegraph defaults
      return origProcessKey.apply(this, arguments)
    }
  }

  /**
   * Draws group header bar
   */
  #addDrawGroupsHandler() {
    const self = this
    const origDrawGroups = LGraphCanvas.prototype.drawGroups
    LGraphCanvas.prototype.drawGroups = function (canvas, ctx) {
      if (!this.graph) {
        return
      }

      var groups = this.graph.groups

      ctx.save()
      ctx.globalAlpha = 0.7 * this.editor_alpha

      for (var i = 0; i < groups.length; ++i) {
        var group = groups[i]

        if (!LiteGraph.overlapBounding(this.visible_area, group._bounding)) {
          continue
        } //out of the visible area

        ctx.fillStyle = group.color || '#335'
        ctx.strokeStyle = group.color || '#335'
        var pos = group._pos
        var size = group._size
        ctx.globalAlpha = 0.25 * this.editor_alpha
        ctx.beginPath()
        var font_size = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
        ctx.rect(pos[0] + 0.5, pos[1] + 0.5, size[0], font_size * 1.4)
        ctx.fill()
        ctx.globalAlpha = this.editor_alpha
      }

      ctx.restore()

      const res = origDrawGroups.apply(this, arguments)
      return res
    }
  }

  /**
   * Draws node highlights (executing, drag drop) and progress bar
   */
  #addDrawNodeHandler() {
    const origDrawNodeShape = LGraphCanvas.prototype.drawNodeShape
    const self = this
    LGraphCanvas.prototype.drawNodeShape = function (
      node,
      ctx,
      size,
      fgcolor,
      bgcolor,
      selected
    ) {
      const res = origDrawNodeShape.apply(this, arguments)

      const nodeErrors = self.lastNodeErrors?.[node.id]

      let color = null
      let lineWidth = 1
      if (node.id === +self.runningNodeId) {
        color = '#0f0'
      } else if (self.dragOverNode && node.id === self.dragOverNode.id) {
        color = 'dodgerblue'
      } else if (nodeErrors?.errors) {
        color = 'red'
        lineWidth = 2
      } else if (
        self.lastExecutionError &&
        +self.lastExecutionError.node_id === node.id
      ) {
        color = '#f0f'
        lineWidth = 2
      }

      if (color) {
        const shape =
          node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        if (shape == LiteGraph.BOX_SHAPE)
          ctx.rect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT
          )
        else if (
          shape == LiteGraph.ROUND_SHAPE ||
          (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
        )
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            this.round_radius * 2
          )
        else if (shape == LiteGraph.CARD_SHAPE)
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            [this.round_radius * 2, this.round_radius * 2, 2, 2]
          )
        else if (shape == LiteGraph.CIRCLE_SHAPE)
          ctx.arc(
            size[0] * 0.5,
            size[1] * 0.5,
            size[0] * 0.5 + 6,
            0,
            Math.PI * 2
          )
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.strokeStyle = fgcolor
        ctx.globalAlpha = 1
      }

      if (self.progress && node.id === +self.runningNodeId) {
        ctx.fillStyle = 'green'
        ctx.fillRect(
          0,
          0,
          size[0] * (self.progress.value / self.progress.max),
          6
        )
        ctx.fillStyle = bgcolor
      }

      // Highlight inputs that failed validation
      if (nodeErrors) {
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        for (const error of nodeErrors.errors) {
          if (error.extra_info && error.extra_info.input_name) {
            const inputIndex = node.findInputSlot(error.extra_info.input_name)
            if (inputIndex !== -1) {
              let pos = node.getConnectionPos(true, inputIndex)
              ctx.beginPath()
              ctx.arc(
                pos[0] - node.pos[0],
                pos[1] - node.pos[1],
                12,
                0,
                2 * Math.PI,
                false
              )
              ctx.stroke()
            }
          }
        }
      }

      return res
    }

    const origDrawNode = LGraphCanvas.prototype.drawNode
    LGraphCanvas.prototype.drawNode = function (node, ctx) {
      const editor_alpha = this.editor_alpha
      const old_color = node.color
      const old_bgcolor = node.bgcolor

      if (node.mode === LGraphEventMode.NEVER) {
        this.editor_alpha = 0.4
      }

      let bgColor: string
      if (node.mode === LGraphEventMode.BYPASS) {
        bgColor = app.bypassBgColor
        this.editor_alpha = 0.2
      } else {
        bgColor = old_bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR
      }

      const adjustments: ColorAdjustOptions = {}

      const opacity = useSettingStore().get('Comfy.Node.Opacity')
      if (opacity) adjustments.opacity = opacity

      if (useSettingStore().get('Comfy.ColorPalette') === 'light') {
        adjustments.lightness = 0.5

        // Lighten title bar of colored nodes on light theme
        if (old_color) {
          node.color = adjustColor(old_color, { lightness: 0.5 })
        }
      }

      node.bgcolor = adjustColor(bgColor, adjustments)

      const res = origDrawNode.apply(this, arguments)

      this.editor_alpha = editor_alpha
      node.color = old_color
      node.bgcolor = old_bgcolor

      return res
    }
  }

  /**
   * Handles updates from the API socket
   */
  #addApiUpdateHandlers() {
    api.addEventListener('status', ({ detail }) => {
      this.ui.setStatus(detail)
    })

    api.addEventListener('progress', ({ detail }) => {
      this.progress = detail
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executing', ({ detail }) => {
      this.progress = null
      this.graph.setDirtyCanvas(true, false)
      delete this.nodePreviewImages[this.runningNodeId]
    })

    api.addEventListener('executed', ({ detail }) => {
      const output = this.nodeOutputs[detail.display_node || detail.node]
      if (detail.merge && output) {
        for (const k in detail.output ?? {}) {
          const v = output[k]
          if (v instanceof Array) {
            output[k] = v.concat(detail.output[k])
          } else {
            output[k] = detail.output[k]
          }
        }
      } else {
        this.nodeOutputs[detail.display_node || detail.node] = detail.output
      }
      const node = this.graph.getNodeById(detail.display_node || detail.node)
      if (node) {
        if (node.onExecuted) node.onExecuted(detail.output)
      }
    })

    api.addEventListener('execution_start', ({ detail }) => {
      this.lastExecutionError = null
      this.graph.nodes.forEach((node) => {
        if (node.onExecutionStart) node.onExecutionStart()
      })
    })

    api.addEventListener('execution_error', ({ detail }) => {
      this.lastExecutionError = detail
      showExecutionErrorDialog(detail)
      this.canvas.draw(true, true)
    })

    api.addEventListener('b_preview', ({ detail }) => {
      const id = this.runningNodeId
      if (id == null) return

      const blob = detail
      const blobUrl = URL.createObjectURL(blob)
      // @ts-expect-error
      this.nodePreviewImages[id] = [blobUrl]
    })

    api.init()
  }

  #addConfigureHandler() {
    const app = this
    const configure = LGraph.prototype.configure
    // Flag that the graph is configuring to prevent nodes from running checks while its still loading
    LGraph.prototype.configure = function () {
      app.configuringGraph = true
      try {
        return configure.apply(this, arguments)
      } finally {
        app.configuringGraph = false
      }
    }
  }

  #addWidgetLinkHandling() {
    app.canvas.getWidgetLinkType = function (widget, node) {
      const nodeDefStore = useNodeDefStore()
      const nodeDef = nodeDefStore.nodeDefsByName[node.type]
      const input = nodeDef.inputs.getInput(widget.name)
      return input?.type
    }

    type ConnectingWidgetLink = {
      subType: 'connectingWidgetLink'
      widget: IWidget
      node: LGraphNode
      link: { node: LGraphNode; slot: number }
    }

    document.addEventListener(
      'litegraph:canvas',
      async (e: CustomEvent<ConnectingWidgetLink>) => {
        if (e.detail.subType === 'connectingWidgetLink') {
          const { convertToInput } = await import(
            '@/extensions/core/widgetInputs'
          )

          const { node, link, widget } = e.detail
          if (!node || !link || !widget) return

          const nodeData = node.constructor.nodeData
          if (!nodeData) return
          const all = {
            ...nodeData?.input?.required,
            ...nodeData?.input?.optional
          }
          const inputSpec = all[widget.name]
          if (!inputSpec) return

          const input = convertToInput(node, widget, inputSpec)
          if (!input) return

          const originNode = link.node

          originNode.connect(link.slot, node, node.inputs.lastIndexOf(input))
        }
      }
    )
  }

  #addAfterConfigureHandler() {
    const app = this
    const onConfigure = app.graph.onConfigure
    app.graph.onConfigure = function () {
      // Fire callbacks before the onConfigure, this is used by widget inputs to setup the config
      for (const node of app.graph.nodes) {
        node.onGraphConfigured?.()
      }

      const r = onConfigure?.apply(this, arguments)

      // Fire after onConfigure, used by primitives to generate widget using input nodes config
      for (const node of app.graph.nodes) {
        node.onAfterGraphConfigured?.()
      }

      return r
    }
  }

  /**
   * Loads all extensions from the API into the window in parallel
   */
  async #loadExtensions() {
    useExtensionStore().loadDisabledExtensionNames()

    const extensions = await api.getExtensions()

    // Need to load core extensions first as some custom extensions
    // may depend on them.
    await import('../extensions/core/index')
    await Promise.all(
      extensions
        .filter((extension) => !extension.includes('extensions/core'))
        .map(async (ext) => {
          try {
            await import(/* @vite-ignore */ api.fileURL(ext))
          } catch (error) {
            console.error('Error loading extension', ext, error)
          }
        })
    )
  }

  /**
   * Set up the app on the page
   */
  async setup(canvasEl: HTMLCanvasElement) {
    this.canvasEl = canvasEl
    // Show menu container for GraphView.
    this.ui.menuContainer.style.display = 'block'

    this.resizeCanvas()

    await Promise.all([
      useWorkspaceStore().workflow.syncWorkflows(),
      this.ui.settings.load()
    ])
    await this.#loadExtensions()

    this.#addProcessMouseHandler()
    this.#addProcessKeyHandler()
    this.#addConfigureHandler()
    this.#addApiUpdateHandlers()
    this.#addRestoreWorkflowView()

    this.graph = new LGraph()

    this.#addAfterConfigureHandler()

    // Make LGraphCanvas.state shallow reactive so that any change on the root
    // object triggers reactivity.
    this.canvas = new LGraphCanvas(canvasEl, this.graph)
    this.canvas.state = shallowReactive(this.canvas.state)

    this.ctx = canvasEl.getContext('2d')

    LiteGraph.alt_drag_do_clone_nodes = true

    this.graph.start()

    // Ensure the canvas fills the window
    this.resizeCanvas()
    window.addEventListener('resize', () => this.resizeCanvas())
    const ro = new ResizeObserver(() => this.resizeCanvas())
    ro.observe(this.bodyTop)
    ro.observe(this.bodyLeft)
    ro.observe(this.bodyRight)
    ro.observe(this.bodyBottom)

    await this.#invokeExtensionsAsync('init')
    await this.registerNodes()
    initWidgets(this)

    // Load previous workflow
    let restored = false
    try {
      const loadWorkflow = async (json) => {
        if (json) {
          const workflow = JSON.parse(json)
          const workflowName = getStorageValue('Comfy.PreviousWorkflow')
          await this.loadGraphData(workflow, true, true, workflowName)
          return true
        }
      }
      const clientId = api.initialClientId ?? api.clientId
      restored =
        (clientId &&
          (await loadWorkflow(
            sessionStorage.getItem(`workflow:${clientId}`)
          ))) ||
        (await loadWorkflow(localStorage.getItem('workflow')))
    } catch (err) {
      console.error('Error loading previous workflow', err)
    }

    // We failed to restore a workflow so load the default
    if (!restored) {
      await this.loadGraphData()
    }

    this.#addDrawNodeHandler()
    this.#addDrawGroupsHandler()
    this.#addDropHandler()
    this.#addCopyHandler()
    this.#addPasteHandler()
    this.#addWidgetLinkHandling()

    await this.#invokeExtensionsAsync('setup')
  }

  resizeCanvas() {
    // Limit minimal scale to 1, see https://github.com/comfyanonymous/ComfyUI/pull/845
    const scale = Math.max(window.devicePixelRatio, 1)

    // Clear fixed width and height while calculating rect so it uses 100% instead
    this.canvasEl.height = this.canvasEl.width = NaN
    const { width, height } = this.canvasEl.getBoundingClientRect()
    this.canvasEl.width = Math.round(width * scale)
    this.canvasEl.height = Math.round(height * scale)
    this.canvasEl.getContext('2d').scale(scale, scale)
    this.canvas?.draw(true, true)
  }

  private updateVueAppNodeDefs(defs: Record<string, ComfyNodeDef>) {
    // Frontend only nodes registered by custom nodes.
    // Example: https://github.com/rgthree/rgthree-comfy/blob/dd534e5384be8cf0c0fa35865afe2126ba75ac55/src_web/comfyui/fast_groups_bypasser.ts#L10
    const rawDefs = Object.fromEntries(
      Object.entries(LiteGraph.registered_node_types).map(([name, node]) => [
        name,
        {
          name,
          display_name: name,
          category: node.category || '__frontend_only__',
          input: { required: {}, optional: {} },
          output: [],
          output_name: [],
          output_is_list: [],
          python_module: 'custom_nodes.frontend_only',
          description: `Frontend only node for ${name}`
        }
      ])
    )

    const allNodeDefs = {
      ...rawDefs,
      ...defs,
      ...SYSTEM_NODE_DEFS
    }

    const nodeDefStore = useNodeDefStore()
    const nodeDefArray: ComfyNodeDef[] = Object.values(allNodeDefs)
    this.#invokeExtensions('beforeRegisterVueAppNodeDefs', nodeDefArray, this)
    nodeDefStore.updateNodeDefs(nodeDefArray)
  }

  #translateNodeDefs(defs: Record<string, ComfyNodeDef>) {
    return Object.fromEntries(
      Object.entries(defs).map(([name, def]) => [
        name,
        {
          ...def,
          display_name: st(
            `nodeDefs.${name}.display_name`,
            def.display_name ?? def.name
          ),
          description: def.description
            ? st(`nodeDefs.${name}.description`, def.description)
            : undefined,
          category: def.category
            .split('/')
            .map((category) => st(`nodeCategories.${category}`, category))
            .join('/')
        }
      ])
    )
  }

  async #getNodeDefs() {
    return this.#translateNodeDefs(
      await api.getNodeDefs({
        validate: useSettingStore().get('Comfy.Validation.NodeDefs')
      })
    )
  }

  /**
   * Registers nodes with the graph
   */
  async registerNodes() {
    // Load node definitions from the backend
    const defs = await this.#getNodeDefs()
    await this.registerNodesFromDefs(defs)
    await this.#invokeExtensionsAsync('registerCustomNodes')
    if (this.vueAppReady) {
      this.updateVueAppNodeDefs(defs)
    }
  }

  /**
   * Remove the impl after groupNode jest tests are removed.
   * @deprecated Use useWidgetStore().getWidgetType instead
   */
  getWidgetType(inputData, inputName: string) {
    const type = inputData[0]

    if (Array.isArray(type)) {
      return 'COMBO'
    } else if (`${type}:${inputName}` in this.widgets) {
      return `${type}:${inputName}`
    } else if (type in this.widgets) {
      return type
    } else {
      return null
    }
  }

  async registerNodeDef(nodeId: string, nodeData: ComfyNodeDef) {
    const self = this
    const node = class ComfyNode extends LGraphNode {
      static comfyClass? = nodeData.name
      // TODO: change to "title?" once litegraph.d.ts has been updated
      static title = nodeData.display_name || nodeData.name
      static nodeData? = nodeData
      static category?: string

      constructor(title?: string) {
        super(title)
        const requiredInputs = nodeData.input.required

        var inputs = nodeData['input']['required']
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

          const inputIsRequired = requiredInputs && inputName in requiredInputs

          let widgetCreated = true
          const widgetType = self.getWidgetType(inputData, inputName)
          if (widgetType) {
            if (widgetType === 'COMBO') {
              Object.assign(
                config,
                self.widgets.COMBO(this, inputName, inputData, app) || {}
              )
            } else {
              Object.assign(
                config,
                self.widgets[widgetType](this, inputName, inputData, app) || {}
              )
            }
          } else {
            // Node connection inputs
            const inputOptions = inputIsRequired
              ? {}
              : { shape: LiteGraph.SlotShape.HollowCircle }
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
          const outputOptions = outputIsList
            ? { shape: LiteGraph.GRID_SHAPE }
            : {}
          this.addOutput(outputName, output, outputOptions)
        }

        const s = this.computeSize()
        s[0] = Math.max(config.minWidth, s[0] * 1.5)
        s[1] = Math.max(config.minHeight, s[1])
        this.size = s
        this.serialize_widgets = true

        app.#invokeExtensionsAsync('nodeCreated', this)
      }

      configure(data: any) {
        // Keep 'name', 'type', and 'shape' information from the original node definition.
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
          for (const key of ['name', 'type', 'shape']) {
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

    this.#addNodeContextMenuHandler(node)
    this.#addDrawBackgroundHandler(node)
    this.#addNodeKeyHandler(node)

    await this.#invokeExtensionsAsync('beforeRegisterNodeDef', node, nodeData)
    LiteGraph.registerNodeType(nodeId, node)
    // Note: Do not move this to the class definition, it will be overwritten
    node.category = nodeData.category
  }

  async registerNodesFromDefs(defs: Record<string, ComfyNodeDef>) {
    await this.#invokeExtensionsAsync('addCustomNodeDefs', defs)

    // Register a node for each definition
    for (const nodeId in defs) {
      this.registerNodeDef(nodeId, defs[nodeId])
    }
  }

  loadTemplateData(templateData) {
    if (!templateData?.templates) {
      return
    }

    const old = localStorage.getItem('litegrapheditor_clipboard')

    var maxY, nodeBottom, node

    for (const template of templateData.templates) {
      if (!template?.data) {
        continue
      }

      // Check for old clipboard format
      const data = JSON.parse(template.data)
      if (!data.reroutes) {
        deserialiseAndCreate(template.data, app.canvas)
      } else {
        localStorage.setItem('litegrapheditor_clipboard', template.data)
        app.canvas.pasteFromClipboard()
      }

      // Move mouse position down to paste the next template below

      maxY = false

      for (const i in app.canvas.selected_nodes) {
        node = app.canvas.selected_nodes[i]

        nodeBottom = node.pos[1] + node.size[1]

        if (maxY === false || nodeBottom > maxY) {
          maxY = nodeBottom
        }
      }

      app.canvas.graph_mouse[1] = maxY + 50
    }

    localStorage.setItem('litegrapheditor_clipboard', old)
  }

  #showMissingNodesError(missingNodeTypes: MissingNodeType[]) {
    if (useSettingStore().get('Comfy.Workflow.ShowMissingNodesWarning')) {
      showLoadWorkflowWarning({ missingNodeTypes })
    }
  }

  #showMissingModelsError(missingModels, paths) {
    if (useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')) {
      showMissingModelsWarning({
        missingModels,
        paths
      })
    }
  }

  async loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean: boolean = true,
    restore_view: boolean = true,
    workflow: string | null | ComfyWorkflow = null,
    { showMissingNodesDialog = true, showMissingModelsDialog = true } = {}
  ) {
    if (clean !== false) {
      this.clean()
    }

    let reset_invalid_values = false
    if (!graphData) {
      graphData = defaultGraph
      reset_invalid_values = true
    }

    if (typeof structuredClone === 'undefined') {
      graphData = JSON.parse(JSON.stringify(graphData))
    } else {
      graphData = structuredClone(graphData)
    }

    if (useSettingStore().get('Comfy.Validation.Workflows')) {
      // TODO: Show validation error in a dialog.
      const validatedGraphData = await validateComfyWorkflow(
        graphData,
        /* onError=*/ (err) => {
          useToastStore().addAlert(err)
        }
      )
      // If the validation failed, use the original graph data.
      // Ideally we should not block users from loading the workflow.
      graphData = validatedGraphData ?? graphData
    }

    workflowService.beforeLoadNewGraph()

    const missingNodeTypes: MissingNodeType[] = []
    const missingModels = []
    await this.#invokeExtensionsAsync(
      'beforeConfigureGraph',
      graphData,
      missingNodeTypes
      // TODO: missingModels
    )
    for (let n of graphData.nodes) {
      // Patch T2IAdapterLoader to ControlNetLoader since they are the same node now
      if (n.type == 'T2IAdapterLoader') n.type = 'ControlNetLoader'
      if (n.type == 'ConditioningAverage ') n.type = 'ConditioningAverage' //typo fix
      if (n.type == 'SDV_img2vid_Conditioning')
        n.type = 'SVD_img2vid_Conditioning' //typo fix

      // Find missing node types
      if (!(n.type in LiteGraph.registered_node_types)) {
        missingNodeTypes.push(n.type)
        n.type = sanitizeNodeName(n.type)
      }
    }
    if (
      graphData.models &&
      useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')
    ) {
      for (const m of graphData.models) {
        const models_available = await useModelStore().getLoadedModelFolder(
          m.directory
        )
        if (models_available === null) {
          // @ts-expect-error
          m.directory_invalid = true
          missingModels.push(m)
        } else if (!(m.name in models_available.models)) {
          missingModels.push(m)
        }
      }
    }

    try {
      // @ts-expect-error Discrepancies between zod and litegraph - in progress
      this.graph.configure(graphData)
      if (
        restore_view &&
        useSettingStore().get('Comfy.EnableWorkflowViewRestore') &&
        graphData.extra?.ds
      ) {
        // @ts-expect-error
        // Need to set strict: true for zod to match the type [number, number]
        // https://github.com/colinhacks/zod/issues/3056
        this.canvas.ds.offset = graphData.extra.ds.offset
        this.canvas.ds.scale = graphData.extra.ds.scale
      }
    } catch (error) {
      let errorHint = []
      // Try extracting filename to see if it was caused by an extension script
      const filename =
        error.fileName ||
        (error.stack || '').match(/(\/extensions\/.*\.js)/)?.[1]
      const pos = (filename || '').indexOf('/extensions/')
      if (pos > -1) {
        errorHint.push(
          $el('span', {
            textContent: 'This may be due to the following script:'
          }),
          $el('br'),
          $el('span', {
            style: {
              fontWeight: 'bold'
            },
            textContent: filename.substring(pos)
          })
        )
      }

      // Show dialog to let the user know something went wrong loading the data
      this.ui.dialog.show(
        $el('div', [
          $el('p', {
            textContent: 'Loading aborted due to error reloading workflow data'
          }),
          $el('pre', {
            style: { padding: '5px', backgroundColor: 'rgba(255,0,0,0.2)' },
            textContent: error.toString()
          }),
          $el('pre', {
            style: {
              padding: '5px',
              color: '#ccc',
              fontSize: '10px',
              maxHeight: '50vh',
              overflow: 'auto',
              backgroundColor: 'rgba(0,0,0,0.2)'
            },
            textContent: error.stack || 'No stacktrace available'
          }),
          ...errorHint
        ]).outerHTML
      )

      return
    }
    for (const node of this.graph.nodes) {
      const size = node.computeSize()
      size[0] = Math.max(node.size[0], size[0])
      size[1] = Math.max(node.size[1], size[1])
      node.size = size
      if (node.widgets) {
        // If you break something in the backend and want to patch workflows in the frontend
        // This is the place to do this
        for (let widget of node.widgets) {
          if (node.type == 'KSampler' || node.type == 'KSamplerAdvanced') {
            if (widget.name == 'sampler_name') {
              if (
                typeof widget.value === 'string' &&
                widget.value.startsWith('sample_')
              ) {
                widget.value = widget.value.slice(7)
              }
            }
          }
          if (
            node.type == 'KSampler' ||
            node.type == 'KSamplerAdvanced' ||
            node.type == 'PrimitiveNode'
          ) {
            if (widget.name == 'control_after_generate') {
              if (widget.value === true) {
                // @ts-expect-error change widget type from boolean to string
                widget.value = 'randomize'
              } else if (widget.value === false) {
                // @ts-expect-error change widget type from boolean to string
                widget.value = 'fixed'
              }
            }
          }
          if (reset_invalid_values) {
            if (widget.type == 'combo') {
              if (
                !widget.options.values.includes(widget.value as string) &&
                widget.options.values.length > 0
              ) {
                widget.value = widget.options.values[0]
              }
            }
          }
        }
      }

      this.#invokeExtensions('loadedGraphNode', node)
    }

    // TODO: Properly handle if both nodes and models are missing (sequential dialogs?)
    if (missingNodeTypes.length && showMissingNodesDialog) {
      this.#showMissingNodesError(missingNodeTypes)
    }
    if (missingModels.length && showMissingModelsDialog) {
      const paths = await api.getFolderPaths()
      this.#showMissingModelsError(missingModels, paths)
    }
    await this.#invokeExtensionsAsync('afterConfigureGraph', missingNodeTypes)
    // @ts-expect-error zod types issue. Will be fixed after we enable ts-strict
    await workflowService.afterLoadNewGraph(workflow, this.graph.serialize())
    requestAnimationFrame(() => {
      this.graph.setDirtyCanvas(true, true)
    })
  }

  /**
   * Serializes a graph using preferred user settings.
   * @param graph The litegraph to serialize.
   * @returns A serialized graph (aka workflow) with preferred user settings.
   */
  serializeGraph(graph: LGraph = this.graph) {
    const sortNodes = useSettingStore().get('Comfy.Workflow.SortNodeIdOnSave')
    return graph.serialize({ sortNodes })
  }

  /**
   * Converts the current graph workflow for sending to the API.
   * Note: Node widgets are updated before serialization to prepare queueing.
   * @returns The workflow and node links
   */
  async graphToPrompt(graph = this.graph, clean = true) {
    for (const outerNode of this.graph.computeExecutionOrder(false)) {
      if (outerNode.widgets) {
        for (const widget of outerNode.widgets) {
          // Allow widgets to run callbacks before a prompt has been queued
          // e.g. random seed before every gen
          widget.beforeQueued?.()
        }
      }

      const innerNodes = outerNode.getInnerNodes
        ? outerNode.getInnerNodes()
        : [outerNode]
      for (const node of innerNodes) {
        if (node.isVirtualNode) {
          // Don't serialize frontend only nodes but let them make changes
          if (node.applyToGraph) {
            node.applyToGraph()
          }
        }
      }
    }

    const workflow = this.serializeGraph(graph)
    const output = {}
    // Process nodes in order of execution
    for (const outerNode of graph.computeExecutionOrder(false)) {
      const skipNode =
        outerNode.mode === LGraphEventMode.NEVER ||
        outerNode.mode === LGraphEventMode.BYPASS
      const innerNodes =
        !skipNode && outerNode.getInnerNodes
          ? outerNode.getInnerNodes()
          : [outerNode]
      for (const node of innerNodes) {
        if (node.isVirtualNode) {
          continue
        }

        if (
          node.mode === LGraphEventMode.NEVER ||
          node.mode === LGraphEventMode.BYPASS
        ) {
          // Don't serialize muted nodes
          continue
        }

        const inputs = {}
        const widgets = node.widgets

        // Store all widget values
        if (widgets) {
          for (const i in widgets) {
            const widget = widgets[i]
            if (!widget.options || widget.options.serialize !== false) {
              inputs[widget.name] = widget.serializeValue
                ? await widget.serializeValue(node, i)
                : widget.value
            }
          }
        }

        // Store all node links
        for (let i in node.inputs) {
          let parent = node.getInputNode(i)
          if (parent) {
            let link = node.getInputLink(i)
            while (
              parent.mode === LGraphEventMode.BYPASS ||
              parent.isVirtualNode
            ) {
              let found = false
              if (parent.isVirtualNode) {
                link = parent.getInputLink(link.origin_slot)
                if (link) {
                  parent = parent.getInputNode(link.target_slot)
                  if (parent) {
                    found = true
                  }
                }
              } else if (link && parent.mode === LGraphEventMode.BYPASS) {
                let all_inputs = [link.origin_slot]
                if (parent.inputs) {
                  all_inputs = all_inputs.concat(Object.keys(parent.inputs))
                  for (let parent_input in all_inputs) {
                    parent_input = all_inputs[parent_input]
                    if (
                      parent.inputs[parent_input]?.type === node.inputs[i].type
                    ) {
                      link = parent.getInputLink(parent_input)
                      if (link) {
                        parent = parent.getInputNode(parent_input)
                      }
                      found = true
                      break
                    }
                  }
                }
              }

              if (!found) {
                break
              }
            }

            if (link) {
              if (parent?.updateLink) {
                link = parent.updateLink(link)
              }
              if (link) {
                inputs[node.inputs[i].name] = [
                  String(link.origin_id),
                  parseInt(link.origin_slot)
                ]
              }
            }
          }
        }

        const node_data = {
          inputs,
          class_type: node.comfyClass
        }

        // Ignored by the backend.
        node_data['_meta'] = {
          title: node.title
        }

        output[String(node.id)] = node_data
      }
    }

    // Remove inputs connected to removed nodes
    if (clean) {
      for (const o in output) {
        for (const i in output[o].inputs) {
          if (
            Array.isArray(output[o].inputs[i]) &&
            output[o].inputs[i].length === 2 &&
            !output[output[o].inputs[i][0]]
          ) {
            delete output[o].inputs[i]
          }
        }
      }
    }

    return { workflow, output }
  }

  #formatPromptError(error) {
    if (error == null) {
      return '(unknown error)'
    } else if (typeof error === 'string') {
      return error
    } else if (error.stack && error.message) {
      return error.toString()
    } else if (error.response) {
      let message = error.response.error.message
      if (error.response.error.details)
        message += ': ' + error.response.error.details
      for (const [nodeID, nodeError] of Object.entries(
        error.response.node_errors
      )) {
        // @ts-expect-error
        message += '\n' + nodeError.class_type + ':'
        // @ts-expect-error
        for (const errorReason of nodeError.errors) {
          message +=
            '\n    - ' + errorReason.message + ': ' + errorReason.details
        }
      }
      return message
    }
    return '(unknown error)'
  }

  async queuePrompt(number, batchCount = 1) {
    this.#queueItems.push({ number, batchCount })

    // Only have one action process the items so each one gets a unique seed correctly
    if (this.#processingQueue) {
      return
    }

    this.#processingQueue = true
    this.lastNodeErrors = null

    try {
      while (this.#queueItems.length) {
        ;({ number, batchCount } = this.#queueItems.pop())

        for (let i = 0; i < batchCount; i++) {
          const p = await this.graphToPrompt()

          try {
            // @ts-expect-error Discrepancies between zod and litegraph - in progress
            const res = await api.queuePrompt(number, p)
            this.lastNodeErrors = res.node_errors
            if (this.lastNodeErrors.length > 0) {
              this.canvas.draw(true, true)
            } else {
              try {
                useExecutionStore().storePrompt({
                  id: res.prompt_id,
                  nodes: Object.keys(p.output),
                  workflow: useWorkspaceStore().workflow
                    .activeWorkflow as ComfyWorkflow
                })
              } catch (error) {}
            }
          } catch (error) {
            const formattedError = this.#formatPromptError(error)
            this.ui.dialog.show(formattedError)
            if (error.response) {
              this.lastNodeErrors = error.response.node_errors
              this.canvas.draw(true, true)
            }
            break
          }

          for (const n of p.workflow.nodes) {
            const node = this.graph.getNodeById(n.id)
            if (node.widgets) {
              for (const widget of node.widgets) {
                // Allow widgets to run callbacks after a prompt has been queued
                // e.g. random seed after every gen
                // @ts-expect-error
                if (widget.afterQueued) {
                  // @ts-expect-error
                  widget.afterQueued()
                }
              }
            }
          }

          this.canvas.draw(true, true)
          await this.ui.queue.update()
        }
      }
    } finally {
      this.#processingQueue = false
    }
    api.dispatchCustomEvent('promptQueued', { number, batchCount })
    return !this.lastNodeErrors
  }

  showErrorOnFileLoad(file) {
    this.ui.dialog.show(
      $el('div', [
        $el('p', { textContent: `Unable to find workflow in ${file.name}` })
      ]).outerHTML
    )
  }

  /**
   * Loads workflow data from the specified file
   * @param {File} file
   */
  async handleFile(file) {
    const removeExt = (f) => {
      if (!f) return f
      const p = f.lastIndexOf('.')
      if (p === -1) return f
      return f.substring(0, p)
    }
    const fileName = removeExt(file.name)
    if (file.type === 'image/png') {
      const pngInfo = await getPngMetadata(file)
      if (pngInfo?.workflow) {
        await this.loadGraphData(
          JSON.parse(pngInfo.workflow),
          true,
          true,
          fileName
        )
      } else if (pngInfo?.prompt) {
        this.loadApiJson(JSON.parse(pngInfo.prompt), fileName)
      } else if (pngInfo?.parameters) {
        // Note: Not putting this in `importA1111` as it is mostly not used
        // by external callers, and `importA1111` has no access to `app`.
        workflowService.beforeLoadNewGraph()
        importA1111(this.graph, pngInfo.parameters)
        // @ts-expect-error zod type issue on ComfyWorkflowJSON. Should be resolved after enabling ts-strict globally.
        workflowService.afterLoadNewGraph(fileName, this.serializeGraph())
      } else {
        this.showErrorOnFileLoad(file)
      }
    } else if (file.type === 'image/webp') {
      const pngInfo = await getWebpMetadata(file)
      // Support loading workflows from that webp custom node.
      const workflow = pngInfo?.workflow || pngInfo?.Workflow
      const prompt = pngInfo?.prompt || pngInfo?.Prompt

      if (workflow) {
        this.loadGraphData(JSON.parse(workflow), true, true, fileName)
      } else if (prompt) {
        this.loadApiJson(JSON.parse(prompt), fileName)
      } else {
        this.showErrorOnFileLoad(file)
      }
    } else if (file.type === 'audio/flac' || file.type === 'audio/x-flac') {
      const pngInfo = await getFlacMetadata(file)
      const workflow = pngInfo?.workflow || pngInfo?.Workflow
      const prompt = pngInfo?.prompt || pngInfo?.Prompt

      if (workflow) {
        this.loadGraphData(JSON.parse(workflow), true, true, fileName)
      } else if (prompt) {
        this.loadApiJson(JSON.parse(prompt), fileName)
      } else {
        this.showErrorOnFileLoad(file)
      }
    } else if (
      file.type === 'application/json' ||
      file.name?.endsWith('.json')
    ) {
      const reader = new FileReader()
      reader.onload = async () => {
        const readerResult = reader.result as string
        const jsonContent = JSON.parse(readerResult)
        if (jsonContent?.templates) {
          this.loadTemplateData(jsonContent)
        } else if (this.isApiJson(jsonContent)) {
          this.loadApiJson(jsonContent, fileName)
        } else {
          await this.loadGraphData(
            JSON.parse(readerResult),
            true,
            false,
            fileName
          )
        }
      }
      reader.readAsText(file)
    } else if (
      file.name?.endsWith('.latent') ||
      file.name?.endsWith('.safetensors')
    ) {
      const info = await getLatentMetadata(file)
      // TODO define schema to LatentMetadata
      // @ts-expect-error
      if (info.workflow) {
        await this.loadGraphData(
          // @ts-expect-error
          JSON.parse(info.workflow),
          true,
          true,
          fileName
        )
        // @ts-expect-error
      } else if (info.prompt) {
        // @ts-expect-error
        this.loadApiJson(JSON.parse(info.prompt))
      } else {
        this.showErrorOnFileLoad(file)
      }
    } else {
      this.showErrorOnFileLoad(file)
    }
  }

  isApiJson(data) {
    // @ts-expect-error
    return Object.values(data).every((v) => v.class_type)
  }

  loadApiJson(apiData, fileName: string) {
    workflowService.beforeLoadNewGraph()

    const missingNodeTypes = Object.values(apiData).filter(
      // @ts-expect-error
      (n) => !LiteGraph.registered_node_types[n.class_type]
    )
    if (missingNodeTypes.length) {
      this.#showMissingNodesError(
        // @ts-expect-error
        missingNodeTypes.map((t) => t.class_type)
      )
      return
    }

    const ids = Object.keys(apiData)
    app.graph.clear()
    for (const id of ids) {
      const data = apiData[id]
      const node = LiteGraph.createNode(data.class_type)
      node.id = isNaN(+id) ? id : +id
      node.title = data._meta?.title ?? node.title
      app.graph.add(node)
    }

    for (const id of ids) {
      const data = apiData[id]
      const node = app.graph.getNodeById(id)
      for (const input in data.inputs ?? {}) {
        const value = data.inputs[input]
        if (value instanceof Array) {
          const [fromId, fromSlot] = value
          const fromNode = app.graph.getNodeById(fromId)
          let toSlot = node.inputs?.findIndex((inp) => inp.name === input)
          if (toSlot == null || toSlot === -1) {
            try {
              // Target has no matching input, most likely a converted widget
              const widget = node.widgets?.find((w) => w.name === input)
              // @ts-expect-error
              if (widget && node.convertWidgetToInput?.(widget)) {
                toSlot = node.inputs?.length - 1
              }
            } catch (error) {}
          }
          if (toSlot != null || toSlot !== -1) {
            fromNode.connect(fromSlot, node, toSlot)
          }
        } else {
          const widget = node.widgets?.find((w) => w.name === input)
          if (widget) {
            widget.value = value
            widget.callback?.(value)
          }
        }
      }
    }
    app.graph.arrange()

    for (const id of ids) {
      const data = apiData[id]
      const node = app.graph.getNodeById(id)
      for (const input in data.inputs ?? {}) {
        const value = data.inputs[input]
        if (value instanceof Array) {
          const [fromId, fromSlot] = value
          const fromNode = app.graph.getNodeById(fromId)
          let toSlot = node.inputs?.findIndex((inp) => inp.name === input)
          if (toSlot == null || toSlot === -1) {
            try {
              // Target has no matching input, most likely a converted widget
              const widget = node.widgets?.find((w) => w.name === input)
              // @ts-expect-error
              if (widget && node.convertWidgetToInput?.(widget)) {
                toSlot = node.inputs?.length - 1
              }
            } catch (error) {}
          }
          if (toSlot != null || toSlot !== -1) {
            fromNode.connect(fromSlot, node, toSlot)
          }
        } else {
          const widget = node.widgets?.find((w) => w.name === input)
          if (widget) {
            widget.value = value
            widget.callback?.(value)
          }
        }
      }
    }

    app.graph.arrange()

    // @ts-expect-error zod type issue on ComfyWorkflowJSON. Should be resolved after enabling ts-strict globally.
    workflowService.afterLoadNewGraph(fileName, this.serializeGraph())
  }

  /**
   * Registers a Comfy web extension with the app
   * @param {ComfyExtension} extension
   */
  registerExtension(extension: ComfyExtension) {
    if (this.vueAppReady) {
      useExtensionStore().registerExtension(extension)
    } else {
      // For jest testing.
      this.extensions.push(extension)
    }
  }

  /**
   * Refresh combo list on whole nodes
   */
  async refreshComboInNodes() {
    const requestToastMessage: ToastMessageOptions = {
      severity: 'info',
      summary: 'Update',
      detail: 'Update requested'
    }
    if (this.vueAppReady) {
      useToastStore().add(requestToastMessage)
    }

    const defs = await this.#getNodeDefs()
    for (const nodeId in defs) {
      this.registerNodeDef(nodeId, defs[nodeId])
    }
    for (let nodeNum in this.graph.nodes) {
      const node = this.graph.nodes[nodeNum]
      const def = defs[node.type]
      // Allow primitive nodes to handle refresh
      node.refreshComboInNode?.(defs)

      if (!def) continue

      for (const widgetNum in node.widgets) {
        const widget = node.widgets[widgetNum]
        if (
          widget.type == 'combo' &&
          def['input']['required'][widget.name] !== undefined
        ) {
          widget.options.values = def['input']['required'][widget.name][0]
        }
      }
    }

    await this.#invokeExtensionsAsync('refreshComboInNodes', defs)

    if (this.vueAppReady) {
      this.updateVueAppNodeDefs(defs)
      useToastStore().remove(requestToastMessage)
      useToastStore().add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Node definitions updated',
        life: 1000
      })
    }
  }

  resetView() {
    app.canvas.ds.scale = 1
    app.canvas.ds.offset = [0, 0]
    app.graph.setDirtyCanvas(true, true)
  }

  /**
   * Clean current state
   */
  clean() {
    this.nodeOutputs = {}
    this.nodePreviewImages = {}
    this.lastNodeErrors = null
    this.lastExecutionError = null
  }

  addNodeOnGraph(
    nodeDef: ComfyNodeDef | ComfyNodeDefImpl,
    options: Record<string, any> = {}
  ): LGraphNode {
    const node = LiteGraph.createNode(
      nodeDef.name,
      nodeDef.display_name,
      options
    )
    this.graph.add(node)
    return node
  }

  clientPosToCanvasPos(pos: Vector2): Vector2 {
    const rect = this.canvasContainer.getBoundingClientRect()
    const containerOffsets = [rect.left, rect.top]
    return _.zip(pos, this.canvas.ds.offset, containerOffsets).map(
      ([p, o1, o2]) => (p - o2) / this.canvas.ds.scale - o1
    ) as Vector2
  }

  canvasPosToClientPos(pos: Vector2): Vector2 {
    const rect = this.canvasContainer.getBoundingClientRect()
    const containerOffsets = [rect.left, rect.top]
    return _.zip(pos, this.canvas.ds.offset, containerOffsets).map(
      ([p, o1, o2]) => (p + o1) * this.canvas.ds.scale + o2
    ) as Vector2
  }

  getCanvasCenter(): Vector2 {
    const dpi = Math.max(window.devicePixelRatio ?? 1, 1)
    const [x, y, w, h] = app.canvas.ds.visible_area
    return [x + w / dpi / 2, y + h / dpi / 2]
  }

  public goToNode(nodeId: NodeId) {
    const graphNode = this.graph.getNodeById(nodeId)
    if (!graphNode) return
    this.canvas.animateToBounds(graphNode.boundingRect)
  }
}

export const app = new ComfyApp()
