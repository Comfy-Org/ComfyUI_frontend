// @ts-strict-ignore
import {
  LGraph,
  LGraphCanvas,
  LGraphEventMode,
  LGraphNode,
  LiteGraph,
  strokeShape
} from '@comfyorg/litegraph'
import type { IWidget, Rect, Vector2 } from '@comfyorg/litegraph'
import _ from 'lodash'
import type { ToastMessageOptions } from 'primevue/toast'
import { reactive } from 'vue'

import { st } from '@/i18n'
import type { ResultItem } from '@/schemas/apiSchema'
import {
  type ComfyWorkflowJSON,
  type ModelFile,
  type NodeId,
  validateComfyWorkflow
} from '@/schemas/comfyWorkflowSchema'
import { type ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { getFromWebmFile } from '@/scripts/metadata/ebml'
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
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyExtension, MissingNodeType } from '@/types/comfy'
import { ExtensionManager } from '@/types/extensionTypes'
import { ColorAdjustOptions, adjustColor } from '@/utils/colorUtil'
import { graphToPrompt } from '@/utils/executionUtil'
import { executeWidgetsCallback, isImageNode } from '@/utils/litegraphUtil'
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
import { clone } from './utils'
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
  widgets?: Pick<IWidget, 'type' | 'name' | 'value'>[] | null
  imgs?: HTMLImageElement[] | null
  original_imgs?: HTMLImageElement[] | null
  images?: any[] | null
  selectedIndex: number
  img_paste_mode: string
}

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

  /**
   * @deprecated Use {@link isImageNode} from @/utils/litegraphUtil instead
   */
  static isImageNode(node: LGraphNode) {
    return isImageNode(node)
  }

  /**
   * Resets the canvas view to the default
   * @deprecated Use {@link useLitegraphService().resetView} instead
   */
  resetView() {
    useLitegraphService().resetView()
  }

  constructor() {
    this.vueAppReady = false
    this.ui = new ComfyUI(this)
    this.api = api
    // Dummy placeholder elements before GraphCanvas is mounted.
    this.bodyTop = $el('div.comfyui-body-top')
    this.bodyLeft = $el('div.comfyui-body-left')
    this.bodyRight = $el('div.comfyui-body-right')
    this.bodyBottom = $el('div.comfyui-body-bottom')
    this.canvasContainer = $el('div.graph-canvas-container')

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

  static pasteFromClipspace(node: LGraphNode) {
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
              // @ts-expect-error custom widget type
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
              (obj) => obj.type === type && obj.name === name
            )
            if (prop && prop.type != 'button') {
              if (
                // @ts-expect-error Custom widget type
                prop.type != 'image' &&
                typeof prop.value == 'string' &&
                // @ts-expect-error Custom widget value
                value.filename
              ) {
                const resultItem = value as ResultItem
                prop.value =
                  (resultItem.subfolder ? resultItem.subfolder + '/' : '') +
                  resultItem.filename +
                  (resultItem.type ? ` [${resultItem.type}]` : '')
              } else {
                prop.value = value
                prop.callback?.(value)
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
          offset: [...self.canvas.ds.offset]
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
   * Draws node highlights (executing, drag drop) and progress bar
   */
  #addDrawNodeHandler() {
    const origDrawNodeShape = LGraphCanvas.prototype.drawNodeShape
    const self = this
    LGraphCanvas.prototype.drawNodeShape = function (
      node,
      ctx,
      size,
      _fgcolor,
      bgcolor
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
        const area: Rect = [
          0,
          -LiteGraph.NODE_TITLE_HEIGHT,
          size[0],
          size[1] + LiteGraph.NODE_TITLE_HEIGHT
        ]
        strokeShape(ctx, area, {
          shape: node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE,
          thickness: lineWidth,
          colour: color,
          title_height: LiteGraph.NODE_TITLE_HEIGHT,
          collapsed: node.collapsed
        })
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
    LGraphCanvas.prototype.drawNode = function (node) {
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

      if (useColorPaletteStore().completedActivePalette.light_theme) {
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

    api.addEventListener('progress', () => {
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executing', () => {
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

    api.addEventListener('execution_start', () => {
      this.lastExecutionError = null
      this.graph.nodes.forEach((node) => {
        if (node.onExecutionStart) node.onExecutionStart()
      })
    })

    api.addEventListener('execution_error', ({ detail }) => {
      this.lastExecutionError = detail
      useDialogService().showExecutionErrorDialog({ error: detail })
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
    this.bodyTop = document.getElementById('comfyui-body-top')
    this.bodyLeft = document.getElementById('comfyui-body-left')
    this.bodyRight = document.getElementById('comfyui-body-right')
    this.bodyBottom = document.getElementById('comfyui-body-bottom')
    this.canvasContainer = document.getElementById('graph-canvas-container')

    this.canvasEl = canvasEl
    this.resizeCanvas()

    await useWorkspaceStore().workflow.syncWorkflows()
    await useExtensionService().loadExtensions()

    this.#addProcessKeyHandler()
    this.#addConfigureHandler()
    this.#addApiUpdateHandlers()
    this.#addRestoreWorkflowView()

    this.graph = new LGraph()

    this.#addAfterConfigureHandler()

    this.canvas = new LGraphCanvas(canvasEl, this.graph)
    // Make canvas states reactive so we can observe changes on them.
    this.canvas.state = reactive(this.canvas.state)
    this.canvas.ds.state = reactive(this.canvas.ds.state)

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

    this.#addDrawNodeHandler()
    this.#addDropHandler()

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

  private updateVueAppNodeDefs(
    defs: Record<string, ComfyNodeDefV1 & ComfyNodeDefV2>
  ) {
    // Frontend only nodes registered by custom nodes.
    // Example: https://github.com/rgthree/rgthree-comfy/blob/dd534e5384be8cf0c0fa35865afe2126ba75ac55/src_web/comfyui/fast_groups_bypasser.ts#L10
    const rawDefs: Record<string, ComfyNodeDefV1> = Object.fromEntries(
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
    const nodeDefArray: ComfyNodeDefV1[] = Object.values(allNodeDefs)
    useExtensionService().invokeExtensions(
      'beforeRegisterVueAppNodeDefs',
      nodeDefArray,
      this
    )
    nodeDefStore.updateNodeDefs(nodeDefArray)
  }

  async #getNodeDefs(): Promise<Record<string, ComfyNodeDefV1>> {
    const translateNodeDef = (def: ComfyNodeDefV1): ComfyNodeDefV1 => ({
      ...def,
      display_name: st(
        `nodeDefs.${def.name}.display_name`,
        def.display_name ?? def.name
      ),
      description: def.description
        ? st(`nodeDefs.${def.name}.description`, def.description)
        : undefined,
      category: def.category
        .split('/')
        .map((category: string) => st(`nodeCategories.${category}`, category))
        .join('/')
    })

    return _.mapValues(
      await api.getNodeDefs({
        validate: useSettingStore().get('Comfy.Validation.NodeDefs')
      }),
      (def) => translateNodeDef(def)
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

  async registerNodeDef(nodeId: string, nodeDef: ComfyNodeDefV1) {
    return await useLitegraphService().registerNodeDef(nodeId, nodeDef)
  }

  async registerNodesFromDefs(defs: Record<string, ComfyNodeDefV1>) {
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
    const missingModels: ModelFile[] = []
    await useExtensionService().invokeExtensionsAsync(
      'beforeConfigureGraph',
      graphData,
      missingNodeTypes
      // TODO: missingModels
    )

    const embeddedModels: ModelFile[] = []

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

      // Collect models metadata from node
      if (n.properties?.models?.length)
        embeddedModels.push(...n.properties.models)
    }

    // Merge models from the workflow's root-level 'models' field
    const workflowSchemaV1Models = graphData.models
    if (workflowSchemaV1Models?.length)
      embeddedModels.push(...workflowSchemaV1Models)

    const getModelKey = (model: ModelFile) => model.url || model.hash
    const validModels = embeddedModels.filter(getModelKey)
    const uniqueModels = _.uniqBy(validModels, getModelKey)

    if (
      uniqueModels.length &&
      useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')
    ) {
      const modelStore = useModelStore()
      await modelStore.loadModelFolders()
      for (const m of uniqueModels) {
        const modelFolder = await modelStore.getLoadedModelFolder(m.directory)
        // @ts-expect-error
        if (!modelFolder) m.directory_invalid = true

        const modelsAvailable = modelFolder?.models
        const modelExists =
          modelsAvailable &&
          Object.values(modelsAvailable).some(
            (model) => model.file_name === m.name
          )
        if (!modelExists) missingModels.push(m)
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
      node.setSize(size)
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
                // @ts-expect-error string is not assignable to boolean
                widget.value = 'randomize'
              } else if (widget.value === false) {
                // @ts-expect-error string is not assignable to boolean
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

  async graphToPrompt(graph = this.graph) {
    return graphToPrompt(graph, {
      sortNodes: useSettingStore().get('Comfy.Workflow.SortNodeIdOnSave')
    })
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
      for (const [_, nodeError] of Object.entries(error.response.node_errors)) {
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

  async queuePrompt(number: number, batchCount: number = 1): Promise<boolean> {
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
          // Allow widgets to run callbacks before a prompt has been queued
          // e.g. random seed before every gen
          executeWidgetsCallback(this.graph.nodes, 'beforeQueued')

          const p = await this.graphToPrompt()
          try {
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

          // Allow widgets to run callbacks after a prompt has been queued
          // e.g. random seed after every gen
          executeWidgetsCallback(
            p.workflow.nodes.map((n) => this.graph.getNodeById(n.id)),
            'afterQueued'
          )
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

  onUnhandledFile(file: File) {
    // Fire custom event to allow other parts of the app to handle the file
    const unhandled = api.dispatchCustomEvent(
      'unhandledFileDrop',
      { file },
      {
        cancelable: true
      }
    )

    if (unhandled) {
      // Nothing handled the event, so show the error dialog
      this.ui.dialog.show(
        $el('div.unhandled-file-dialog', [
          $el('p', { textContent: `Unable to find workflow in ${file.name}` })
        ]).outerHTML
      )
    }
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
        this.onUnhandledFile(file)
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
        this.onUnhandledFile(file)
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
        this.onUnhandledFile(file)
      }
    } else if (file.type === 'video/webm') {
      const webmInfo = await getFromWebmFile(file)
      if (webmInfo.workflow) {
        this.loadGraphData(webmInfo.workflow, true, true, fileName)
      } else if (webmInfo.prompt) {
        this.loadApiJson(webmInfo.prompt, fileName)
      } else {
        this.onUnhandledFile(file)
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
      if (info?.workflow) {
        await this.loadGraphData(
          // @ts-expect-error
          JSON.parse(info.workflow),
          true,
          true,
          fileName
        )
        // @ts-expect-error
      } else if (info?.prompt) {
        // @ts-expect-error
        this.loadApiJson(JSON.parse(info.prompt))
      } else {
        this.onUnhandledFile(file)
      }
    } else {
      this.onUnhandledFile(file)
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
    for (const node of this.graph.nodes) {
      const def = defs[node.type]
      // Allow primitive nodes to handle refresh
      node.refreshComboInNode?.(defs)

      if (!def?.input) continue

      for (const widget of node.widgets) {
        if (widget.type === 'combo') {
          if (def['input'].required?.[widget.name] !== undefined) {
            // @ts-expect-error InputSpec is not typed correctly
            widget.options.values = def['input'].required[widget.name][0]
          } else if (def['input'].optional?.[widget.name] !== undefined) {
            // @ts-expect-error InputSpec is not typed correctly
            widget.options.values = def['input'].optional[widget.name][0]
          }
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
