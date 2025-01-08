// @ts-strict-ignore
import {
  LGraph,
  LGraphCanvas,
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@comfyorg/litegraph'
import { Vector2 } from '@comfyorg/litegraph'
import _ from 'lodash'
import type { ToastMessageOptions } from 'primevue/toast'
import { shallowReactive } from 'vue'

import { st } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { useExtensionService } from '@/services/extensionService'
import { useLitegraphService } from '@/services/litegraphService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeyComboImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useModelStore } from '@/stores/modelStore'
import { SYSTEM_NODE_DEFS, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyNodeDef } from '@/types/apiTypes'
import type { ComfyExtension, MissingNodeType } from '@/types/comfy'
import {
  type ComfyWorkflowJSON,
  type NodeId,
  validateComfyWorkflow
} from '@/types/comfyWorkflow'
import { ExtensionManager } from '@/types/extensionTypes'
import { ColorAdjustOptions, adjustColor } from '@/utils/colorUtil'
import { deserialiseAndCreate } from '@/utils/vintageClipboard'

import { type ComfyApi, api } from './api'
import { defaultGraph } from './defaultGraph'
import {
  getFlacMetadata,
  getLatentMetadata,
  getPngMetadata,
  getWebpMetadata,
  importA1111
} from './pnginfo'
import { $el, ComfyUI } from './ui'
import { ComfyAppMenu } from './ui/menu/index'
import { clone, getStorageValue } from './utils'
import { type ComfyWidgetConstructor, ComfyWidgets } from './widgets'

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
  extensionManager: ExtensionManager
  _nodeOutputs: Record<string, any>
  nodePreviewImages: Record<string, string[]>
  graph: LGraph
  canvas: LGraphCanvas
  dragOverNode: LGraphNode | null
  canvasEl: HTMLCanvasElement
  // x, y, scale
  zoom_drag_start: [number, number, number] | null
  lastNodeErrors: any[] | null
  /** @type {ExecutionErrorWsMessage} */
  lastExecutionError: { node_id?: NodeId } | null
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

  /**
   * @deprecated Use useExtensionStore().extensions instead
   */
  get extensions(): ComfyExtension[] {
    return useExtensionStore().extensions
  }

  /**
   * The progress on the current executing node, if the node reports any.
   * @deprecated Use useExecutionStore().executingNodeProgress instead
   */
  get progress() {
    return useExecutionStore()._executingNodeProgress
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
    if (this.vueAppReady)
      useExtensionService().invokeExtensions('onNodeOutputsUpdated', value)
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
        if (keybinding && keybinding.targetElementId === 'graph-canvas') {
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
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executing', ({ detail }) => {
      this.graph.setDirtyCanvas(true, false)
      this.revokePreviews(this.runningNodeId)
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
      useDialogService().showExecutionErrorDialog(detail)
      this.canvas.draw(true, true)
    })

    api.addEventListener('b_preview', ({ detail }) => {
      const id = this.runningNodeId
      if (id == null) return

      const blob = detail
      const blobUrl = URL.createObjectURL(blob)
      // Ensure clean up if `executing` event is missed.
      this.revokePreviews(id)
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
   * Set up the app on the page
   */
  async setup(canvasEl: HTMLCanvasElement) {
    this.canvasEl = canvasEl
    this.resizeCanvas()

    await useWorkspaceStore().workflow.syncWorkflows()
    await useExtensionService().loadExtensions()

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

    await useExtensionService().invokeExtensionsAsync('init')
    await this.registerNodes()

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

    await useExtensionService().invokeExtensionsAsync('setup')
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
    useExtensionService().invokeExtensions(
      'beforeRegisterVueAppNodeDefs',
      nodeDefArray,
      this
    )
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
    await useExtensionService().invokeExtensionsAsync('registerCustomNodes')
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
    return await useLitegraphService().registerNodeDef(nodeId, nodeData)
  }

  async registerNodesFromDefs(defs: Record<string, ComfyNodeDef>) {
    await useExtensionService().invokeExtensionsAsync('addCustomNodeDefs', defs)

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
      useDialogService().showLoadWorkflowWarning({ missingNodeTypes })
    }
  }

  #showMissingModelsError(missingModels, paths) {
    if (useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')) {
      useDialogService().showMissingModelsWarning({
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

    graphData = clone(graphData)

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

    useWorkflowService().beforeLoadNewGraph()

    const missingNodeTypes: MissingNodeType[] = []
    const missingModels = []
    await useExtensionService().invokeExtensionsAsync(
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

      useExtensionService().invokeExtensions('loadedGraphNode', node)
    }

    // TODO: Properly handle if both nodes and models are missing (sequential dialogs?)
    if (missingNodeTypes.length && showMissingNodesDialog) {
      this.#showMissingNodesError(missingNodeTypes)
    }
    if (missingModels.length && showMissingModelsDialog) {
      const paths = await api.getFolderPaths()
      this.#showMissingModelsError(missingModels, paths)
    }
    await useExtensionService().invokeExtensionsAsync(
      'afterConfigureGraph',
      missingNodeTypes
    )
    await useWorkflowService().afterLoadNewGraph(
      workflow,
      // @ts-expect-error zod types issue. Will be fixed after we enable ts-strict
      this.graph.serialize()
    )
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
    for (const outerNode of graph.computeExecutionOrder(false)) {
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

    // Remove localized_name from the workflow
    for (const node of workflow.nodes) {
      for (const slot of node.inputs) {
        delete slot.localized_name
      }
      for (const slot of node.outputs) {
        delete slot.localized_name
      }
    }

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
        useWorkflowService().beforeLoadNewGraph()
        importA1111(this.graph, pngInfo.parameters)
        // @ts-expect-error zod type issue on ComfyWorkflowJSON. Should be resolved after enabling ts-strict globally.
        useWorkflowService().afterLoadNewGraph(fileName, this.serializeGraph())
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
    useWorkflowService().beforeLoadNewGraph()

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
    useWorkflowService().afterLoadNewGraph(fileName, this.serializeGraph())
  }

  /**
   * Registers a Comfy web extension with the app
   * @param {ComfyExtension} extension
   * @deprecated Use useExtensionService().registerExtension instead
   */
  registerExtension(extension: ComfyExtension) {
    useExtensionService().registerExtension(extension)
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

    await useExtensionService().invokeExtensionsAsync(
      'refreshComboInNodes',
      defs
    )

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
   * Frees memory allocated to image preview blobs for a specific node, by revoking the URLs associated with them.
   * @param nodeId ID of the node to revoke all preview images of
   */
  revokePreviews(nodeId: NodeId) {
    if (!this.nodePreviewImages[nodeId]?.[Symbol.iterator]) return
    for (const url of this.nodePreviewImages[nodeId]) {
      URL.revokeObjectURL(url)
    }
  }
  /**
   * Clean current state
   */
  clean() {
    this.nodeOutputs = {}
    for (const id of Object.keys(this.nodePreviewImages)) {
      this.revokePreviews(id)
    }
    this.nodePreviewImages = {}
    this.lastNodeErrors = null
    this.lastExecutionError = null
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
}

export const app = new ComfyApp()
