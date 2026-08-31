import { useEventListener, useResizeObserver } from '@vueuse/core'
import _ from 'es-toolkit/compat'
import type { ToastMessageOptions } from 'primevue/toast'
import { reactive, unref } from 'vue'
import { shallowRef } from 'vue'

import { useCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'

import { promotedInputSource } from '@/core/graph/subgraph/promotedInputWidget'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { setBackendNodeText, st, t } from '@/i18n'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { ChangeTracker } from '@/scripts/changeTracker'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import { createMutationView } from '@/lib/litegraph/src/infrastructure/createMutationView'
import {
  inputAsSerialisable,
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { snapPoint } from '@/lib/litegraph/src/measure'
import type { Vector2 } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { installNodeAddedTelemetry } from '@/platform/telemetry/nodeAdded/installNodeAddedTelemetry'
import { normalizeExecutionTriggerSource } from '@/platform/telemetry/types'
import { getExecutionContext } from '@/platform/telemetry/utils/getExecutionContext'
import { groupMissingNodesByPack } from '@/platform/telemetry/utils/groupMissingNodesByPack'
import { toWorkflowExecutionContext } from '@/platform/telemetry/utils/workflowExecutionContext'
import type {
  ExecutionContext,
  WorkflowExecutionContext,
  WorkflowExecutionIntent,
  WorkflowOpenSource,
  WorkflowQueueIntent
} from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { updatePendingWarnings } from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowValidation } from '@/platform/workflow/validation/composables/useWorkflowValidation'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import {
  collectSubgraphDefinitions,
  buildSubgraphExecutionPaths
} from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  NodeExecutionOutput,
  ResultItem
} from '@/schemas/apiSchema'
import {
  type ComfyNodeDef as ComfyNodeDefV1,
  isComboInputSpecV1,
  isComboInputSpecV2
} from '@/schemas/nodeDefSchema'
import {
  type BaseDOMWidget,
  ComponentWidgetImpl,
  DOMWidgetImpl
} from '@/scripts/domWidget'
import { useAccountPreconditionDialog } from '@/platform/cloud/subscription/composables/useAccountPreconditionDialog'
import { resolveAccountPrecondition } from '@/platform/errorCatalog/accountPreconditionRouting'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { useExtensionService } from '@/services/extensionService'
import { useLitegraphService } from '@/services/litegraphService'
import { useSubgraphService } from '@/services/subgraphService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import {
  getAncestorExecutionIds,
  tryNormalizeNodeExecutionId
} from '@/types/nodeIdentification'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { SYSTEM_NODE_DEFS, useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'

import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyExtension, MissingNodeType } from '@/types/comfy'
import type { ExtensionManager } from '@/types/extensionTypes'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { normalizePromptError } from '@/utils/executionErrorUtil'
import { graphToPrompt, unwrapExportedWidgetValue } from '@/utils/executionUtil'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'
import { getCnrIdFromProperties } from '@/platform/nodeReplacement/cnrIdUtil'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { rescanAndSurfaceMissingNodes } from '@/platform/nodeReplacement/missingNodeScan'
import {
  refreshMissingModelPipeline,
  runMissingModelPipeline
} from '@/platform/missingModel/missingModelPipeline'
import type { MissingModelPipelineResult } from '@/platform/missingModel/missingModelPipeline'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { runMissingMediaPipeline } from '@/platform/missingMedia/missingMediaPipeline'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'

import { getWorkflowMode } from '@/utils/appMode'
import { anyItemOverlapsRect } from '@/utils/mathUtil'
import {
  collectAllNodes,
  forEachNode,
  getNodeByExecutionId,
  isAncestorPathActive,
  triggerCallbackOnAllNodes
} from '@/utils/graphTraversalUtil'
import {
  executeWidgetsCallback,
  createNode,
  isImageNode,
  isSelectOnly,
  isVideoNode
} from '@/utils/litegraphUtil'
import {
  createSharedObjectUrl,
  releaseSharedObjectUrl
} from '@/utils/objectUrlUtil'
import {
  findLegacyRerouteNodes,
  noNativeReroutes
} from '@/utils/migration/migrateReroute'
import { deserialiseAndCreate } from '@/utils/vintageClipboard'

import { type ComfyApi, PromptExecutionError, api } from './api'
import { defaultGraph } from './defaultGraph'
import { importA1111 } from './pnginfo'
import { applyPromotedWidgetControl } from './promotedWidgetControl'
import { $el, ComfyUI } from './ui'
import { ComfyAppMenu } from './ui/menu/index'
import { clone } from './utils'
import { type ComfyWidgetConstructor } from './widgets'
import { ensureCorrectLayoutScale } from '@/renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale'
import {
  extractFilesFromDragEvent,
  hasAudioType,
  hasImageType,
  hasVideoType,
  isMediaFile
} from '@/utils/eventUtils'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { SUPPORTED_MESH_EXTENSIONS } from '@/extensions/core/load3d/constants'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import {
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes
} from '@/composables/usePaste'

export const ANIM_PREVIEW_WIDGET = '$$comfy_animation_preview'

function isMeshModelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return SUPPORTED_MESH_EXTENSIONS.has(name.slice(name.lastIndexOf('.')))
}

export function sanitizeNodeName(string: string) {
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
    return entityMap[s as keyof typeof entityMap]
  })
}

function syncPromotedComboHostOptions(rootGraph: LGraph): void {
  const widgetValueStore = useWidgetValueStore()
  forEachNode(rootGraph, (node) => {
    if (!node.isSubgraphNode()) return
    for (const input of node.inputs) {
      if (!input.widgetId) continue

      const source = promotedInputSource(node, input)
      if (!source) continue

      const resolution = resolveConcretePromotedWidget(
        node,
        source.nodeId,
        source.widgetName
      )
      if (resolution.status !== 'resolved') continue

      const sourceWidget = resolution.resolved.widget
      if (sourceWidget.type !== 'combo') continue

      const state = widgetValueStore.getWidget(input.widgetId)
      if (!state) continue

      state.options = { ...(sourceWidget.options ?? {}) }
    }
  })
}

type Clipspace = {
  widgets?: Pick<IBaseWidget, 'type' | 'name' | 'value'>[] | null
  imgs?: HTMLImageElement[] | null
  original_imgs?: HTMLImageElement[] | null
  images?: ResultItem[] | null
  selectedIndex: number
  img_paste_mode: string
  paintedIndex: number
  combinedIndex: number
}

/**
 * Optional inputs to {@link ComfyApp.queuePrompt}. `intent` is telemetry
 * attribution only and never affects what gets executed.
 */
export interface QueuePromptOptions {
  queueNodeIds?: NodeExecutionId[]
  intent?: WorkflowQueueIntent
}

function createNodeOutputsMutationView(
  outputs: Record<string, NodeExecutionOutput>,
  commit: (id: string, output: NodeExecutionOutput | undefined) => void
): Record<string, NodeExecutionOutput> {
  const views = new WeakMap<object, Map<string, object>>()
  const wrapNestedValue = (id: string, value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value
    const existing = views.get(value)?.get(id)
    if (existing) return existing
    const view = createMutationView(value, {
      commit: () => commit(id, outputs[id]),
      mapValue: (_property, nestedValue) => wrapNestedValue(id, nestedValue)
    })
    const viewsById = views.get(value) ?? new Map<string, object>()
    viewsById.set(id, view)
    views.set(value, viewsById)
    return view
  }
  return new Proxy(outputs, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value === 'function') return value.bind(target)
      return wrapNestedValue(String(property), value)
    },
    set(target, property, value) {
      const previous = Reflect.get(target, property, target)
      const updated = Reflect.set(target, property, value, target)
      if (updated && previous !== value) {
        commit(String(property), value as NodeExecutionOutput)
      }
      return updated
    },
    deleteProperty(target, property) {
      const existed = Reflect.has(target, property)
      const deleted = Reflect.deleteProperty(target, property)
      if (deleted && existed) commit(String(property), undefined)
      return deleted
    }
  })
}

export class ComfyApp {
  /**
   * List of entries to queue
   */
  private queueItems: {
    number: number
    batchCount: number
    requestId: number
    queueNodeIds?: NodeExecutionId[]
    workflowQueueIntent?: WorkflowQueueIntent
  }[] = []
  private nextQueueRequestId = 1
  /**
   * If the queue is currently being processed
   */
  private processingQueue: boolean = false

  /**
   * Content Clipboard
   * @type {serialized node object}
   */
  static clipspace: Clipspace | null = null
  static clipspace_invalidate_handler: (() => void) | null = null
  static open_maskeditor: (() => void) | null = null
  static maskeditor_is_opended: (() => void) | null = null
  static clipspace_return_node = null

  vueAppReady: boolean
  api: ComfyApi
  ui: ComfyUI
  extensionManager!: ExtensionManager
  private readonly nodeOutputsData: Record<string, NodeExecutionOutput> = {}
  private readonly _nodeOutputs = createNodeOutputsMutationView(
    this.nodeOutputsData,
    (id, output) => {
      if (!this.vueAppReady) return
      const store = useNodeOutputStore()
      if (output === undefined) store.removeOutputFromLegacy(id)
      else store.setOutputFromLegacy(id, output)
    }
  )
  nodePreviewImages: Record<string, string[]>

  private rootGraphInternal: LGraph | undefined

  // TODO: Migrate internal usage to the
  /** @deprecated Use {@link rootGraph} instead */
  get graph() {
    return this.rootGraphInternal!
  }

  get rootGraph(): LGraph {
    if (!this.rootGraphInternal) {
      console.error('ComfyApp graph accessed before initialization')
    }
    return this.rootGraphInternal!
  }

  /** Whether the root graph has been initialized. Safe to check without triggering error logs. */
  get isGraphReady(): boolean {
    return !!this.rootGraphInternal
  }

  canvas!: LGraphCanvas
  dragOverNode: Pick<LGraphNode, 'onDragDrop' | 'id'> | null = null
  readonly canvasElRef = shallowRef<HTMLCanvasElement>()
  get canvasEl() {
    // TODO: Fix possibly undefined reference
    return unref(this.canvasElRef)!
  }

  private configuringGraphLevel: number = 0
  get configuringGraph() {
    return this.configuringGraphLevel > 0
  }
  ctx!: CanvasRenderingContext2D
  bodyTop: HTMLElement
  bodyLeft: HTMLElement
  bodyRight: HTMLElement
  bodyBottom: HTMLElement
  canvasContainer: HTMLElement
  menu: ComfyAppMenu
  // Set by Comfy.Clipspace extension
  openClipspace: () => void = () => {}

  private positionConversion?: {
    clientPosToCanvasPos: (pos: Vector2) => Vector2
    canvasPosToClientPos: (pos: Vector2) => Vector2
  }

  /**
   * The node errors from the previous execution.
   * @deprecated Use app.extensionManager.lastNodeErrors instead
   */
  get lastNodeErrors(): Record<string, NodeError> | null {
    return useExecutionErrorStore().lastNodeErrors
  }

  /**
   * The error from the previous execution.
   * @deprecated Use app.extensionManager.lastExecutionError instead
   */
  get lastExecutionError(): ExecutionErrorWsMessage | null {
    return useExecutionErrorStore().lastExecutionError
  }

  /**
   * @deprecated Use useExecutionStore().executingNodeId instead
   * TODO: Update to support multiple executing nodes. This getter returns only the first executing node.
   * Consider updating consumers to handle multiple nodes or use executingNodeIds array.
   */
  get runningNodeId(): SerializedNodeId | null {
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
    return Object.fromEntries(useWidgetStore().widgets.entries())
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
    if (value !== this._nodeOutputs) {
      for (const key of Object.keys(this.nodeOutputsData))
        delete this.nodeOutputsData[key]
      Object.assign(this.nodeOutputsData, value)
    }
    if (this.vueAppReady) {
      useNodeOutputStore().replaceOutputsFromLegacy(this.nodeOutputsData)
      useExtensionService().invokeExtensions('onNodeOutputsUpdated', value)
    }
  }

  /**
   * If the user has specified a preferred format to receive preview images in,
   * this function will return that format as a url query param.
   * If the node's outputs are not images, this param should not be used, as it will
   * force the server to load the output file as an image.
   */
  getPreviewFormatParam() {
    let preview_format = useSettingStore().get('Comfy.PreviewFormat')
    if (preview_format) return `&preview=${preview_format}`
    else return ''
  }

  getRandParam() {
    if (isCloud) return ''
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

  static copyToClipspace(node: LGraphNode) {
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

    const paintedIndex = imgs ? imgs.length + 1 : 1
    const combinedIndex = imgs ? imgs.length + 2 : 2

    // for vueNodes mode
    const images = useNodeOutputStore().getNodeOutputs(node)?.images

    ComfyApp.clipspace = {
      widgets: widgets,
      imgs: imgs,
      original_imgs: orig_imgs,
      images: images,
      selectedIndex: selectedIndex,
      img_paste_mode: 'selected', // reset to default im_paste_mode state on copy action
      paintedIndex: paintedIndex,
      combinedIndex: combinedIndex
    }

    ComfyApp.clipspace_return_node = null

    if (ComfyApp.clipspace_invalidate_handler) {
      ComfyApp.clipspace_invalidate_handler()
    }
  }

  static pasteFromClipspace(node: LGraphNode) {
    if (ComfyApp.clipspace) {
      // image paste
      let combinedImgSrc: string | undefined
      if (
        ComfyApp.clipspace.combinedIndex !== undefined &&
        ComfyApp.clipspace.imgs &&
        ComfyApp.clipspace.combinedIndex < ComfyApp.clipspace.imgs.length
      ) {
        combinedImgSrc =
          ComfyApp.clipspace.imgs[ComfyApp.clipspace.combinedIndex].src
      }
      if (ComfyApp.clipspace.imgs && node.imgs) {
        // Update node.images even if it's initially undefined (vueNodes mode)
        if (ComfyApp.clipspace.images) {
          const images =
            ComfyApp.clipspace['img_paste_mode'] == 'selected'
              ? [ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']]]
              : ComfyApp.clipspace.images
          useNodeOutputStore().setNodeOutputImages(node, images)
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

      // Paste the RGB canvas if paintedindex exists
      if (
        ComfyApp.clipspace.imgs?.[ComfyApp.clipspace.paintedIndex] &&
        node.imgs
      ) {
        const paintedImg = new Image()
        paintedImg.src =
          ComfyApp.clipspace.imgs[ComfyApp.clipspace.paintedIndex].src
        node.imgs.push(paintedImg) // Add the RGB canvas to the node's images
      }

      // Store only combined image inside the node if it exists
      if (
        ComfyApp.clipspace.imgs?.[ComfyApp.clipspace.combinedIndex] &&
        node.imgs &&
        combinedImgSrc
      ) {
        const combinedImg = new Image()
        combinedImg.src = combinedImgSrc
        node.imgs = [combinedImg]
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
        if (ComfyApp.clipspace.widgets && node.widgets) {
          ComfyApp.clipspace.widgets.forEach(({ type, name, value }) => {
            const prop = node.widgets?.find(
              (obj) => obj.type === type && obj.name === name
            )
            if (prop && prop.type != 'button') {
              const valueObj = value as Record<string, unknown> | undefined
              if (
                prop.type != 'image' &&
                typeof prop.value == 'string' &&
                valueObj?.filename
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

      app.canvas.setDirty(true)
    }
  }

  /**
   * Adds a handler allowing drag+drop of files onto the window to load workflows
   */
  private addDropHandler() {
    // Get prompt from dropped PNG or json
    useEventListener(document, 'drop', async (event: DragEvent) => {
      try {
        // Skip if already handled (e.g. file drop onto publish dialog tiles)
        if (event.defaultPrevented) return

        event.preventDefault()
        event.stopPropagation()

        const dropCanvas: LGraphCanvas = this.canvas
        if (isSelectOnly(dropCanvas)) {
          this.dragOverNode = null
          return
        }

        // graph_mouse is only updated on mousemove, so when files are dragged
        // in from another window the canvas-space cursor is stale. Sync it
        // from the drop event so nodes created below land at the cursor.
        dropCanvas.adjustMouseEvent(event)
        dropCanvas.graph_mouse[0] = event.canvasX
        dropCanvas.graph_mouse[1] = event.canvasY

        const n = this.dragOverNode
        this.dragOverNode = null
        // Node handles file drop, we dont use the built in onDropFile handler as its buggy
        // If you drag multiple files it will call it multiple times with the same file
        if (await n?.onDragDrop?.(event)) return

        const files = await extractFilesFromDragEvent(event)
        if (files.length === 0) return
        if (this.canvas !== dropCanvas || isSelectOnly(dropCanvas)) return

        const workspace = useWorkspaceStore()
        try {
          workspace.spinner = true
          const imageFiles = files.filter(hasImageType)
          const audioFiles = files.filter(hasAudioType)
          const videoFiles = files.filter(hasVideoType)
          const totalMedia =
            imageFiles.length + audioFiles.length + videoFiles.length
          const hasMultipleMedia = totalMedia > 1

          const createdNodes: LGraphNode[] = []
          const handleFileOptions = {
            deferWarnings: true,
            onNodeCreated: (node: LGraphNode) => createdNodes.push(node)
          }

          if (hasMultipleMedia) {
            if (imageFiles.length > 0) {
              await this.handleFileList(imageFiles)
            }
            if (audioFiles.length > 0) {
              await this.handleAudioFileList(audioFiles)
            }
            if (videoFiles.length > 0) {
              await this.handleVideoFileList(videoFiles)
            }
            for (const file of files.filter((f) => !isMediaFile(f))) {
              await this.handleFile(file, 'file_drop', handleFileOptions)
            }
          } else {
            for (const file of files) {
              await this.handleFile(file, 'file_drop', handleFileOptions)
            }
          }

          this.positionNodes(createdNodes)
        } finally {
          workspace.spinner = false
        }
        useWorkflowService().showPendingWarnings()
      } catch (error: unknown) {
        useToastStore().addAlert(t('toastMessages.dropFileError', { error }))
      }
    })

    // Always clear over node on drag leave
    useEventListener(this.canvasElRef, 'dragleave', async () => {
      if (!this.dragOverNode) return
      this.dragOverNode = null
      this.canvas.setDirty(false, true)
    })

    // Add handler for dropping onto a specific node
    useEventListener(
      this.canvasElRef,
      'dragover',
      (event: DragEvent) => {
        this.canvas.adjustMouseEvent(event)
        const node = this.canvas.graph?.getNodeOnPos(
          event.canvasX,
          event.canvasY
        )

        if (!node?.onDragOver?.(event)) {
          this.dragOverNode = null
          return
        }

        this.dragOverNode = node

        // dragover event is fired very frequently, run this on an animation frame
        requestAnimationFrame(() => {
          this.canvas.setDirty(false, true)
        })
      },
      false
    )
  }

  /**
   * Handle keypress
   */
  private addProcessKeyHandler() {
    const origProcessKey = LGraphCanvas.prototype.processKey
    LGraphCanvas.prototype.processKey = function (e: KeyboardEvent) {
      if (!this.graph) return

      if (e.target instanceof Element && e.target.localName == 'input') {
        return
      }

      if (e.type == 'keydown' && !e.repeat) {
        const keyCombo = KeyComboImpl.fromEvent(e)
        const keybindingStore = useKeybindingStore()
        const keybinding = keybindingStore.getKeybinding(keyCombo)

        if (
          keybinding &&
          keybinding.targetElementId === 'graph-canvas-container'
        ) {
          useCommandStore().execute(keybinding.commandId)

          this.graph.change()
          e.preventDefault()
          e.stopImmediatePropagation()
          return
        }
      }

      // Fall through to Litegraph defaults
      return origProcessKey.apply(this, [e])
    }
  }

  /**
   * Handles updates from the API socket
   */
  private addApiUpdateHandlers() {
    api.addEventListener('status', ({ detail }) => {
      this.ui.setStatus(detail)
    })

    api.addEventListener('progress', () => {
      this.canvas.setDirty(true, false)
    })

    api.addEventListener('executing', () => {
      this.canvas.setDirty(true, false)
    })

    api.addEventListener('executed', ({ detail }) => {
      const nodeOutputStore = useNodeOutputStore()
      const executionId = tryNormalizeNodeExecutionId(
        detail.display_node || detail.node
      )
      if (!executionId) return

      nodeOutputStore.setNodeOutputsByExecutionId(executionId, detail.output, {
        merge: detail.merge
      })

      const node = getNodeByExecutionId(this.rootGraph, executionId)
      if (node && node.onExecuted) {
        node.onExecuted(detail.output)
      }
    })

    api.addEventListener('execution_start', () => {
      triggerCallbackOnAllNodes(this.rootGraph, 'onExecutionStart')
    })

    api.addEventListener('execution_error', ({ detail }) => {
      const precondition = resolveAccountPrecondition({
        exceptionType: detail.exception_type ?? '',
        exceptionMessage: detail.exception_message ?? ''
      })
      if (precondition) {
        useAccountPreconditionDialog().open(precondition, {
          nodeType: detail.node_type
        })
      } else if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
        useExecutionErrorStore().showErrorOverlay()
      } else {
        useDialogService().showExecutionErrorDialog(detail)
      }
      this.canvas.draw(true, true)
    })

    api.addEventListener('b_preview_with_metadata', ({ detail }) => {
      // Enhanced preview with explicit node context
      const { blob, displayNodeId, jobId } = detail
      const { setNodePreviewsByExecutionId, revokePreviewsByExecutionId } =
        useNodeOutputStore()
      const displayNodeExecutionId = tryNormalizeNodeExecutionId(displayNodeId)
      if (!displayNodeExecutionId) return
      const blobUrl = createSharedObjectUrl(blob)
      useJobPreviewStore().setPreviewUrl(jobId, blobUrl, displayNodeId)
      // Ensure clean up if `executing` event is missed.
      revokePreviewsByExecutionId(displayNodeExecutionId)
      // Preview cleanup is handled in progress_state event to support multiple concurrent previews
      for (const executionId of getAncestorExecutionIds(
        displayNodeExecutionId
      )) {
        setNodePreviewsByExecutionId(executionId, [blobUrl])
      }
      releaseSharedObjectUrl(blobUrl)
    })

    api.addEventListener('feature_flags', () => {
      void useNodeReplacementStore().load()
    })

    api.init()
  }

  /** Flag that the graph is configuring to prevent nodes from running checks while its still loading */
  private addConfigureHandler() {
    const app = this
    const configure = LGraph.prototype.configure
    LGraph.prototype.configure = function (...args) {
      app.configuringGraphLevel++
      try {
        return configure.apply(this, args)
      } finally {
        app.configuringGraphLevel--
      }
    }
  }

  private addAfterConfigureHandler(graph: LGraph) {
    const { onConfigure } = graph
    graph.onConfigure = function (...args) {
      // Fire callbacks before the onConfigure, this is used by widget inputs to setup the config
      triggerCallbackOnAllNodes(this, 'onGraphConfigured')

      const r = onConfigure?.apply(this, args)

      // Fire after onConfigure, used by primitives to generate widget using input nodes config
      triggerCallbackOnAllNodes(this, 'onAfterGraphConfigured')

      return r
    }
  }

  /**
   * Set up the app on the page
   */
  async setup(canvasEl: HTMLCanvasElement) {
    this.bodyTop = document.getElementById('comfyui-body-top')!
    this.bodyLeft = document.getElementById('comfyui-body-left')!
    this.bodyRight = document.getElementById('comfyui-body-right')!
    this.bodyBottom = document.getElementById('comfyui-body-bottom')!
    this.canvasContainer = document.getElementById('graph-canvas-container')!

    this.canvasElRef.value = canvasEl

    await useWorkspaceStore().workflow.syncWorkflows()
    //Doesn't need to block. Blueprints will load async
    void useSubgraphStore().fetchSubgraphs()
    await useExtensionService().loadExtensions()

    this.addProcessKeyHandler()
    this.addConfigureHandler()
    this.addApiUpdateHandlers()

    const graph = new LGraph()

    // Register the subgraph - adds type wrapper for Litegraph's `createNode` factory
    graph.events.addEventListener('subgraph-created', (e) => {
      try {
        const { subgraph, data } = e.detail
        useSubgraphService().registerNewSubgraph(subgraph, data)
      } catch (err) {
        console.error('Failed to register subgraph', err)
        useToastStore().add({
          severity: 'error',
          summary: 'Failed to register subgraph',
          detail: err instanceof Error ? err.message : String(err)
        })
      }
    })

    this.addAfterConfigureHandler(graph)

    this.rootGraphInternal = graph
    installNodeAddedTelemetry(graph)
    this.canvas = new LGraphCanvas(canvasEl, graph)
    // Make canvas states reactive so we can observe changes on them.
    this.canvas.state = reactive(this.canvas.state)

    this.ctx = canvasEl.getContext('2d')!

    LiteGraph.alt_drag_do_clone_nodes = true
    LiteGraph.macGesturesRequireMac = false

    this.canvas.canvas.addEventListener<'litegraph:set-graph'>(
      'litegraph:set-graph',
      (e) => {
        const { newGraph } = e.detail

        const widgetStore = useDomWidgetStore()

        const activeWidgets: Record<
          string,
          BaseDOMWidget<object | string>
        > = Object.fromEntries(
          newGraph.nodes
            .flatMap((node) => node.widgets ?? [])
            .filter(
              (w) =>
                w instanceof DOMWidgetImpl || w instanceof ComponentWidgetImpl
            )
            .map((w) => [w.id, w])
        )

        for (const [
          widgetId,
          widgetState
        ] of widgetStore.widgetStates.entries()) {
          if (widgetId in activeWidgets) {
            widgetState.active = true
            widgetState.widget = activeWidgets[widgetId]
          } else {
            widgetState.active = false
          }
        }
      }
    )

    // Ensure subgraphs are scaled when entering them
    this.canvas.canvas.addEventListener<'litegraph:set-graph'>(
      'litegraph:set-graph',
      (e) => {
        const { newGraph, oldGraph } = e.detail
        // Only scale when switching between graphs (not during initial setup)
        // oldGraph is null/undefined during initial setup, so skip scaling then
        if (oldGraph) {
          ensureCorrectLayoutScale(
            newGraph.extra.workflowRendererVersion,
            newGraph
          )
        }
      }
    )

    this.rootGraph.start()

    // Ensure the canvas fills the window
    useResizeObserver(this.canvasElRef, ([canvasEl]) => {
      if (canvasEl.target instanceof HTMLCanvasElement) {
        this.resizeCanvas(canvasEl.target)
      }
    })

    await useExtensionService().invokeExtensionsAsync('init')
    await this.registerNodes()

    this.addDropHandler()

    await useExtensionService().invokeExtensionsAsync('setup')

    this.positionConversion = useCanvasPositionConversion(
      this.canvasContainer,
      this.canvas
    )
  }

  private resizeCanvas(canvas: HTMLCanvasElement) {
    // Limit minimal scale to 1, see https://github.com/comfyanonymous/ComfyUI/pull/845
    const scale = Math.max(window.devicePixelRatio, 1)

    // Clear fixed width and height while calculating rect so it uses 100% instead
    canvas.height = canvas.width = NaN
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    canvas.getContext('2d')?.scale(scale, scale)
    this.canvas?.draw(true, true)
  }

  private updateVueAppNodeDefs(defs: Record<string, ComfyNodeDefV1>) {
    // Frontend only nodes registered by custom nodes.
    // Example: https://github.com/rgthree/rgthree-comfy/blob/dd534e5384be8cf0c0fa35865afe2126ba75ac55/src_web/comfyui/fast_groups_bypasser.ts#L10

    // Only create frontend_only definitions for nodes that don't have backend definitions
    const frontendOnlyDefs: Record<string, ComfyNodeDefV1> = {}
    for (const [name, node] of Object.entries(
      LiteGraph.registered_node_types
    )) {
      // Skip if we already have a backend definition or system definition
      if (name in defs || name in SYSTEM_NODE_DEFS || node.skip_list) {
        continue
      }

      frontendOnlyDefs[name] = {
        name,
        display_name: name,
        category: node.category || '__frontend_only__',
        input: { required: {}, optional: {} },
        output: [],
        output_name: [],
        output_is_list: [],
        output_node: false,
        python_module: 'custom_nodes.frontend_only',
        description: node.description ?? `Frontend only node for ${name}`
      } as ComfyNodeDefV1
    }

    const allNodeDefs = {
      ...frontendOnlyDefs,
      ...defs,
      ...SYSTEM_NODE_DEFS
    }

    const nodeDefStore = useNodeDefStore()
    const nodeDefArray: ComfyNodeDefV1[] = Object.values(allNodeDefs)
    useExtensionService().invokeExtensions(
      'beforeRegisterVueAppNodeDefs',
      nodeDefArray
    )
    nodeDefStore.updateNodeDefs(nodeDefArray)
  }

  async getNodeDefs(): Promise<Record<string, ComfyNodeDefV1>> {
    const translateNodeDef = (def: ComfyNodeDefV1): ComfyNodeDefV1 => {
      return {
        ...def,
        category: (typeof def.category === 'string' ? def.category : '')
          .split('/')
          .map((category: string) =>
            st(`nodeCategories.${normalizeI18nKey(category)}`, category)
          )
          .join('/')
      }
    }

    const isNodeDef = (value: unknown): value is ComfyNodeDefV1 =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { name?: unknown }).name === 'string'

    const response: unknown = await api.getNodeDefs()
    const entries =
      typeof response === 'object' &&
      response !== null &&
      !Array.isArray(response)
        ? Object.entries(response)
        : []
    const defs: Record<string, ComfyNodeDefV1> = Object.fromEntries(
      entries.filter((entry): entry is [string, ComfyNodeDefV1] =>
        isNodeDef(entry[1])
      )
    )
    setBackendNodeText(Object.values(defs))
    return _.mapValues(defs, (def) => translateNodeDef(def))
  }

  /**
   * Registers nodes with the graph
   */
  async registerNodes() {
    // Load node definitions from the backend
    const defs = await this.getNodeDefs()
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
    await Promise.all(
      Object.keys(defs).map((nodeId) =>
        this.registerNodeDef(nodeId, defs[nodeId])
      )
    )
  }

  loadTemplateData(templateData: {
    templates?: { name?: string; data?: string }[]
  }): void {
    if (isSelectOnly(this.canvas)) return
    if (!templateData?.templates) {
      return
    }

    const old = localStorage.getItem('litegrapheditor_clipboard')

    for (const template of templateData.templates) {
      if (!template?.data) {
        continue
      }

      // Check for old clipboard format
      const data = parseJsonWithNonFinite<{ reroutes?: unknown }>(template.data)
      if (!data.reroutes) {
        deserialiseAndCreate(template.data, app.canvas)
      } else {
        localStorage.setItem('litegrapheditor_clipboard', template.data)
        app.canvas.pasteFromClipboard()
      }

      // Move mouse position down to paste the next template below
      let maxY: number | undefined

      for (const i in app.canvas.selected_nodes) {
        const node = app.canvas.selected_nodes[i]
        const nodeBottom = node.pos[1] + node.size[1]
        if (maxY === undefined || nodeBottom > maxY) {
          maxY = nodeBottom
        }
      }

      if (maxY !== undefined) {
        app.canvas.graph_mouse[1] = maxY + 50
      }
    }

    if (old !== null) {
      localStorage.setItem('litegrapheditor_clipboard', old)
    }
  }

  private showMissingNodesError(
    missingNodeTypes: MissingNodeType[],
    options?: { deferWarnings?: boolean }
  ) {
    const activeWorkflow = useWorkspaceStore().workflow.activeWorkflow
    updatePendingWarnings(activeWorkflow, { missingNodeTypes })
    if (!options?.deferWarnings) {
      useWorkflowService().showPendingWarnings(activeWorkflow)
    }
  }

  async loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean: boolean = true,
    restore_view: boolean = true,
    workflow: string | null | ComfyWorkflow = null,
    options: {
      checkForRerouteMigration?: boolean
      openSource?: WorkflowOpenSource
      shareId?: string
      deferWarnings?: boolean
      skipAssetScans?: boolean
      silentAssetErrors?: boolean
      workflowNavigationId?: number
    } = {}
  ): Promise<boolean> {
    const {
      checkForRerouteMigration = false,
      openSource,
      shareId,
      deferWarnings = false,
      skipAssetScans = false,
      silentAssetErrors = false,
      workflowNavigationId
    } = options
    useWorkflowService().beforeLoadNewGraph(clean !== false)
    await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')

    if (skipAssetScans) {
      // Only reset candidates; preserve UI state (fileSizes, etc.)
      // so cached results restored by showPendingWarnings still display sizes.
      // Abort any in-flight verification from the outgoing workflow so a late
      // result cannot repopulate the store after we've switched workflows.
      useMissingModelStore().createVerificationAbortController().abort()
      useMissingMediaStore().createVerificationAbortController().abort()
      useMissingModelStore().setMissingModels([])
      useMissingMediaStore().setMissingMedia([])
    } else {
      useMissingModelStore().clearMissingModels()
      useMissingMediaStore().clearMissingMedia()
    }

    if (clean !== false) {
      // Reset canvas context before configuring a new graph so subgraph UI
      // state from the previous workflow cannot leak into the newly loaded
      // one, and so `clean()` can clear the root graph even when the user is
      // currently inside a subgraph.
      this.canvas.setGraph(this.rootGraph)

      this.clean()
    }

    let reset_invalid_values = false
    // Use explicit validation instead of falsy check to avoid replacing
    // valid but falsy values (empty objects, 0, false, etc.)
    if (
      !graphData ||
      typeof graphData !== 'object' ||
      Array.isArray(graphData)
    ) {
      graphData = defaultGraph
      reset_invalid_values = true
    }

    graphData = clone(graphData)

    if (useSettingStore().get('Comfy.Validation.Workflows')) {
      const { graphData: validatedGraphData } =
        await useWorkflowValidation().validateWorkflow(graphData)

      // If the validation failed, use the original graph data.
      // Ideally we should not block users from loading the workflow.
      graphData = validatedGraphData ?? graphData
    }
    // Only show the reroute migration warning if the workflow does not have native
    // reroutes. Merging reroute network has great complexity, and it is not supported
    // for now.
    // See: https://github.com/Comfy-Org/ComfyUI_frontend/issues/3317
    if (
      checkForRerouteMigration &&
      graphData.version === 0.4 &&
      findLegacyRerouteNodes(graphData).length &&
      noNativeReroutes(graphData)
    ) {
      useToastStore().add({
        group: 'reroute-migration',
        severity: 'warn'
      })
    }
    useSubgraphService().loadSubgraphs(graphData)

    const missingNodeTypes: MissingNodeType[] = []
    await useExtensionService().invokeExtensionsAsync(
      'beforeConfigureGraph',
      graphData,
      missingNodeTypes
    )

    const nodeReplacementStore = useNodeReplacementStore()
    await nodeReplacementStore.load()

    // Collect missing node types from all nodes (root + subgraphs)
    const collectMissingNodes = (
      nodes: readonly FlattenableWorkflowNode[],
      pathPrefix: string = '',
      displayName: string = ''
    ) => {
      if (!Array.isArray(nodes)) {
        console.warn(
          'Workflow nodes data is missing or invalid, skipping node processing',
          { nodes, pathPrefix }
        )
        return
      }
      for (let n of nodes) {
        if (!(n.type in LiteGraph.registered_node_types)) {
          // Always sanitize so configure() can handle unregistered types,
          // but only report as missing if the node is active.
          const isMuted =
            n.mode === LGraphEventMode.NEVER ||
            n.mode === LGraphEventMode.BYPASS
          if (!isMuted) {
            const replacement = nodeReplacementStore.getReplacementFor(n.type)
            const cnrId = getCnrIdFromProperties(
              n.properties as Record<string, unknown> | undefined
            )
            const executionId = pathPrefix
              ? `${pathPrefix}:${n.id}`
              : String(n.id)

            missingNodeTypes.push({
              type: n.type,
              nodeId: executionId,
              cnrId,
              ...(displayName && {
                hint: t('g.inSubgraph', { name: displayName })
              }),
              isReplaceable: replacement !== null,
              replacement: replacement ?? undefined
            })
          }

          n.type = sanitizeNodeName(n.type)
        }
      }
    }

    collectMissingNodes(graphData.nodes)
    const subgraphDefs = collectSubgraphDefinitions(
      graphData.definitions?.subgraphs ?? []
    )
    const subgraphContainerIdMap = buildSubgraphExecutionPaths(
      graphData.nodes,
      subgraphDefs
    )
    for (const subgraph of subgraphDefs) {
      const paths = subgraphContainerIdMap.get(subgraph.id) ?? []
      for (const pathPrefix of paths) {
        collectMissingNodes(
          subgraph.nodes,
          pathPrefix,
          subgraph.name || subgraph.id
        )
      }
    }

    const canvasVisible = !!(this.canvasEl.width && this.canvasEl.height)
    const fitView = () => {
      if (
        restore_view &&
        useSettingStore().get('Comfy.EnableWorkflowViewRestore')
      ) {
        // Always fit view for templates to ensure they're visible on load
        if (openSource === 'template') {
          useLitegraphService().fitView()
        } else if (graphData.extra?.ds) {
          this.canvas.ds.offset = graphData.extra.ds.offset
          this.canvas.ds.scale = graphData.extra.ds.scale

          // Fit view if no nodes visible in restored viewport
          this.canvas.ds.computeVisibleArea(this.canvas.viewport)
          if (
            this.canvas.visible_area.width &&
            this.canvas.visible_area.height &&
            !anyItemOverlapsRect(
              this.rootGraph._nodes,
              this.canvas.visible_area
            )
          ) {
            requestAnimationFrame(() => useLitegraphService().fitView())
          }
        } else {
          useLitegraphService().fitView()
        }
      }
    }

    ChangeTracker.isLoadingGraph = true
    try {
      try {
        // @ts-expect-error Discrepancies between zod and litegraph - in progress
        this.rootGraph.configure(graphData)

        // Save original renderer version before scaling (it gets modified during scaling)
        const originalMainGraphRenderer =
          this.rootGraph.extra.workflowRendererVersion

        // Scale main graph
        ensureCorrectLayoutScale(originalMainGraphRenderer, this.rootGraph)

        // Scale all subgraphs that were loaded with the workflow
        // Use original main graph renderer as fallback (not the modified one)
        for (const subgraph of this.rootGraph.subgraphs.values()) {
          ensureCorrectLayoutScale(
            subgraph.extra.workflowRendererVersion || originalMainGraphRenderer,
            subgraph
          )
        }

        if (canvasVisible) fitView()
      } catch (error) {
        useDialogService().showErrorDialog(error, {
          title: t('errorDialog.loadWorkflowTitle'),
          reportType: 'loadWorkflowError'
        })
        console.error(error)
        // Resolves rather than throws: the close/replacement guards read this outcome.
        return false
      }
      const snapTo = LiteGraph.alwaysSnapToGrid
        ? this.rootGraph.getSnapToGridSize()
        : 0
      forEachNode(this.rootGraph, (node) => {
        const size = node.computeSize()
        size[0] = Math.max(node.size[0], size[0])
        size[1] = Math.max(node.size[1], size[1])
        snapPoint(size, snapTo, 'ceil')
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
                  widget.value = 'randomize'
                } else if (widget.value === false) {
                  widget.value = 'fixed'
                }
              }
            }
            if (widget.type == 'combo') {
              const values = widget.options.values as
                | (string | number | boolean)[]
                | undefined
              if (
                values &&
                values.length > 0 &&
                (widget.value == null ||
                  (reset_invalid_values &&
                    !values.includes(
                      widget.value as string | number | boolean
                    )))
              ) {
                widget.value = values[0]
              }
            }
          }
        }

        useExtensionService().invokeExtensions('loadedGraphNode', node)
      })

      await useExtensionService().invokeExtensionsAsync(
        'afterConfigureGraph',
        missingNodeTypes
      )

      const effectiveShareId =
        shareId ??
        (workflow instanceof ComfyWorkflow ? workflow.shareId : undefined)
      const telemetryPayload = {
        missing_node_count: missingNodeTypes.length,
        missing_node_types: missingNodeTypes.map((node) =>
          typeof node === 'string' ? node : node.type
        ),
        missing_node_packs: groupMissingNodesByPack(missingNodeTypes),
        open_source: openSource ?? 'unknown',
        ...(effectiveShareId ? { share_id: effectiveShareId } : {})
      }
      useTelemetry()?.trackWorkflowOpened(telemetryPayload)
      useTelemetry()?.trackWorkflowImported(telemetryPayload)
      await useWorkflowService().afterLoadNewGraph(
        workflow,
        this.rootGraph.serialize() as unknown as ComfyWorkflowJSON,
        effectiveShareId
      )
      await useExtensionService().invokeExtensionsAsync('afterLoadGraph')

      // If the canvas was not visible and we're a fresh load, resize the canvas and fit the view
      // This fixes switching from app mode to a new graph mode workflow (e.g. load template)
      if (!canvasVisible && (!workflow || typeof workflow === 'string')) {
        this.canvas.resize()
        requestAnimationFrame(() => fitView())
      }

      // Drop missing-node entries whose enclosing subgraph is
      // muted/bypassed. The initial JSON scan only checks each node's
      // own mode; the cascade from an inactive container is applied here
      // using the now-configured live graph.
      const activeMissingNodeTypes = missingNodeTypes.filter(
        (n) =>
          typeof n === 'string' ||
          n.nodeId == null ||
          isAncestorPathActive(this.rootGraph, String(n.nodeId))
      )

      if (!skipAssetScans) {
        await runMissingModelPipeline({
          graph: this.rootGraph,
          graphData,
          missingModelStore: useMissingModelStore(),
          missingNodeTypes: activeMissingNodeTypes,
          silent: silentAssetErrors
        })

        await runMissingMediaPipeline({
          rootGraph: this.rootGraph,
          silent: silentAssetErrors
        })
      }

      if (!deferWarnings) {
        useWorkflowService().showPendingWarnings(undefined, {
          silent: silentAssetErrors
        })
      }

      requestAnimationFrame(() => {
        this.canvas.setDirty(true, true)
      })
      return true
    } finally {
      // Finally: a throwing load still repairs the URL.
      void useSubgraphNavigationStore().updateHash(
        'workflow-load',
        workflowNavigationId
      )
      ChangeTracker.isLoadingGraph = false
    }
  }

  async refreshMissingModels(
    options: { silent?: boolean; reloadDefs?: boolean } = {}
  ): Promise<MissingModelPipelineResult> {
    return refreshMissingModelPipeline({
      graph: this.rootGraph,
      reloadNodeDefs:
        options.reloadDefs === false ? undefined : () => this.reloadNodeDefs(),
      missingModelStore: useMissingModelStore(),
      silent: options.silent ?? true
    })
  }

  async graphToPrompt(graph = this.rootGraph) {
    return graphToPrompt(graph, {
      sortNodes: useSettingStore().get('Comfy.Workflow.SortNodeIdOnSave')
    })
  }

  async queuePrompt(
    number: number,
    batchCount?: number,
    options?: QueuePromptOptions
  ): Promise<boolean>
  async queuePrompt(
    number: number,
    batchCount: number,
    queueNodeIds: NodeExecutionId[]
  ): Promise<boolean>
  async queuePrompt(
    number: number,
    batchCount: number = 1,
    optionsOrQueueNodeIds: QueuePromptOptions | NodeExecutionId[] = {}
  ): Promise<boolean> {
    const options = Array.isArray(optionsOrQueueNodeIds)
      ? { queueNodeIds: optionsOrQueueNodeIds }
      : optionsOrQueueNodeIds
    const { queueNodeIds, intent } = options
    const requestId = this.nextQueueRequestId++
    this.queueItems.push({
      number,
      batchCount,
      queueNodeIds,
      requestId,
      workflowQueueIntent: intent
    })
    api.dispatchCustomEvent('promptQueueing', {
      requestId,
      batchCount
    })

    // Only have one action process the items so each one gets a unique seed correctly
    if (this.processingQueue) {
      return false
    }

    this.processingQueue = true
    const executionStore = useExecutionStore()
    const executionErrorStore = useExecutionErrorStore()
    const telemetry = useTelemetry()
    executionErrorStore.clearRunErrors()
    let queueResultOverride: boolean | null = null

    // Get auth token for backend nodes - uses workspace token if enabled, otherwise Firebase token
    const teamWorkspaceStore = useTeamWorkspaceStore()
    try {
      await teamWorkspaceStore.waitForWorkspaceSwitch()
    } catch (error) {
      useDialogService().showErrorDialog(error, {
        title: t('errorDialog.promptExecutionError'),
        reportType: 'promptExecutionError'
      })
      this.queueItems.length = 0
      this.processingQueue = false
      return false
    }
    const workspaceIdBeforeAuthentication = teamWorkspaceStore.activeWorkspaceId
    const workspaceGenerationBeforeAuthentication =
      teamWorkspaceStore.workspaceTransitionGeneration
    const comfyOrgAuthToken = await useAuthStore().getWorkspaceAuthToken()
    const executionWorkspaceId = teamWorkspaceStore.activeWorkspaceId
    const executionWorkspaceGeneration =
      teamWorkspaceStore.workspaceTransitionGeneration
    const workspaceChangedWhileAuthenticating =
      (workspaceIdBeforeAuthentication !== executionWorkspaceId ||
        workspaceGenerationBeforeAuthentication !==
          executionWorkspaceGeneration) &&
      (isCloud || workspaceIdBeforeAuthentication !== null)
    const comfyOrgApiKey = useApiKeyAuthStore().getApiKey()
    // An API-key session mints no workspace JWT: the key itself is the
    // execution credential and the server resolves its bound workspace. Only a
    // key-authenticated session may pass without a token — a Firebase session
    // whose token mint failed must still fail closed rather than fall back to
    // a stored key and charge the key's workspace.
    const isApiKeySessionExecution =
      !useAuthStore().currentUser && useApiKeyAuthStore().isAuthenticated
    if (
      executionWorkspaceId &&
      !comfyOrgAuthToken &&
      !isApiKeySessionExecution
    ) {
      useDialogService().showErrorDialog(
        new Error(t('toastMessages.userNotAuthenticated')),
        {
          title: t('errorDialog.promptExecutionError'),
          reportType: 'promptExecutionError'
        }
      )
      this.queueItems.length = 0
      this.processingQueue = false
      return false
    }

    try {
      while (this.queueItems.length) {
        const {
          number,
          batchCount,
          queueNodeIds,
          requestId,
          workflowQueueIntent
        } = this.queueItems.pop()!
        let queuedCount = 0
        const workflowExecutionIntent: WorkflowExecutionIntent = {
          trigger_source: normalizeExecutionTriggerSource(
            workflowQueueIntent?.trigger_source
          )
        }
        const previewMethod = useSettingStore().get(
          'Comfy.Execution.PreviewMethod'
        )

        const isPartialExecution = !!queueNodeIds?.length
        for (let i = 0; i < batchCount; i++) {
          let executionContext: ExecutionContext | undefined
          if (telemetry) {
            try {
              executionContext = getExecutionContext()
            } catch (error) {
              console.error(
                '[Telemetry] Workflow context collection failed',
                error
              )
            }
          }

          // Allow widgets to run callbacks before a prompt has been queued
          // e.g. random seed before every gen
          forEachNode(this.rootGraph, (node) => {
            for (const widget of node.widgets ?? []) {
              widget.beforeQueued?.({ isPartialExecution })
            }
            applyPromotedWidgetControl(node, 'beforeQueued')
          })

          // Capture workflow before await — activeWorkflow may change if the
          // user switches tabs while the request is in flight.
          const queuedWorkflow = useWorkspaceStore().workflow
            .activeWorkflow as ComfyWorkflow
          const startTime = performance.now()
          const p = await this.graphToPrompt(this.rootGraph).catch(
            (error: unknown) => {
              telemetry?.trackExecutionOutcome({
                startTime,
                endTime: performance.now(),
                success: false,
                failureReason: 'prompt_build_failed',
                ...workflowExecutionIntent
              })
              throw error
            }
          )
          const queuedNodes = collectAllNodes(this.rootGraph)
          let workflowContext: WorkflowExecutionContext | undefined
          if (executionContext) {
            workflowContext = toWorkflowExecutionContext(executionContext, {
              executableNodeCount: Object.keys(p.output).length,
              executionScope: isPartialExecution ? 'partial' : 'full',
              viewMode: getWorkflowMode(queuedWorkflow)
            })
          }
          if (
            workspaceChangedWhileAuthenticating ||
            executionWorkspaceId !== teamWorkspaceStore.activeWorkspaceId ||
            executionWorkspaceGeneration !==
              teamWorkspaceStore.workspaceTransitionGeneration
          ) {
            useDialogService().showErrorDialog(
              new Error(t('errorDialog.workspaceChangedDuringExecution')),
              {
                title: t('errorDialog.promptExecutionError'),
                reportType: 'promptExecutionError'
              }
            )
            queueResultOverride = false
            break
          }
          try {
            api.authToken = comfyOrgAuthToken
            api.apiKey = comfyOrgApiKey ?? undefined
            const res = await api.queuePrompt(number, p, {
              partialExecutionTargets: queueNodeIds,
              previewMethod
            })
            const responseReceivedAt = performance.now()
            delete api.authToken
            delete api.apiKey
            if (!res.prompt_id) {
              telemetry?.trackExecutionOutcome({
                startTime,
                endTime: responseReceivedAt,
                success: false,
                failureReason: 'submission_rejected',
                ...workflowExecutionIntent,
                ...(workflowContext && { workflowContext })
              })
            }
            executionErrorStore.recordNodeErrors(res.node_errors ?? null)
            queueResultOverride = null
            try {
              if (res.prompt_id) {
                executionStore.storeJob({
                  id: res.prompt_id,
                  nodes: Object.keys(p.output),
                  promptOutput: p.output,
                  startTime,
                  submissionAcceptedAt: responseReceivedAt,
                  workflow: queuedWorkflow,
                  workflowContext,
                  workflowExecutionIntent
                })
              }
            } catch (error) {
              console.warn('Failed to store queued job metadata', {
                promptId: res.prompt_id,
                error
              })
            }
            if (executionErrorStore.hasNodeError) {
              if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
                executionErrorStore.showErrorOverlay()
              }
              this.canvas.draw(true, true)
            }
          } catch (error: unknown) {
            telemetry?.trackExecutionOutcome({
              startTime,
              endTime: performance.now(),
              success: false,
              failureReason:
                error instanceof PromptExecutionError
                  ? 'submission_rejected'
                  : 'submission_failed',
              ...workflowExecutionIntent,
              ...(workflowContext && { workflowContext })
            })
            const hasPromptNodeErrors =
              error instanceof PromptExecutionError &&
              Object.keys(error.response.node_errors ?? {}).length > 0
            const preconditionResponseError =
              error instanceof PromptExecutionError &&
              typeof error.response.error === 'object'
                ? error.response.error
                : undefined
            const promptPrecondition = preconditionResponseError
              ? resolveAccountPrecondition({
                  exceptionType: preconditionResponseError.type,
                  exceptionMessage: preconditionResponseError.message
                })
              : undefined
            // Account preconditions (sign-in, subscription, credits) open their
            // own modal and must stay out of the error panel and error count.
            if (promptPrecondition) {
              useAccountPreconditionDialog().open(promptPrecondition)
              console.error(error)
              break
            }
            if (
              error instanceof PromptExecutionError &&
              typeof error.response.error === 'object' &&
              error.response.error?.type === 'missing_node_type'
            ) {
              // Re-scan the full graph instead of using the server's single-node response.
              rescanAndSurfaceMissingNodes(this.rootGraph)
            } else if (
              error instanceof PromptExecutionError &&
              error.status === 403 &&
              !hasPromptNodeErrors
            ) {
              // User is authenticated but not authorized (e.g. not whitelisted).
              // Show a clear message instead of a generic error or sign-in prompt.
              // The response may be middleware JSON {"message": "..."} or the
              // standard {"error": {"message": "..."}} shape, so check both.
              const raw =
                error.response && typeof error.response === 'object'
                  ? (error.response as Record<string, unknown>)
                  : {}
              const rawError =
                raw.error && typeof raw.error === 'object'
                  ? (raw.error as Record<string, unknown>)
                  : undefined
              const detail =
                typeof raw.message === 'string'
                  ? raw.message
                  : typeof rawError?.message === 'string'
                    ? rawError.message
                    : typeof raw.error === 'string'
                      ? raw.error
                      : t('errorDialog.accessRestrictedMessage')
              useDialogService().showErrorDialog(new Error(detail), {
                title: t('errorDialog.accessRestrictedTitle'),
                reportType: 'accessRestrictedError'
              })
            } else if (
              !useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab') ||
              !(error instanceof PromptExecutionError)
            ) {
              useDialogService().showErrorDialog(error, {
                title: t('errorDialog.promptExecutionError'),
                reportType: 'promptExecutionError'
              })
            }
            console.error(error)

            if (error instanceof PromptExecutionError) {
              // Keep the legacy result before empty node errors are normalized.
              const nodeErrors = error.response.node_errors
              queueResultOverride = !nodeErrors
              executionErrorStore.recordNodeErrors(nodeErrors ?? null)

              // Store prompt-level error separately only when no node-specific errors exist,
              // because node errors already carry the full context. Prompt-level errors
              // (e.g. prompt_no_outputs, no_prompt) lack node IDs and need their own path.
              if (!executionErrorStore.hasNodeError) {
                const promptError = normalizePromptError(error.response.error)
                if (promptError) {
                  executionErrorStore.recordPromptError(promptError)
                }
              }

              if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
                executionErrorStore.showErrorOverlay()
              }
              this.canvas.draw(true, true)
            }
            break
          }

          queuedCount++

          // Allow widgets to run callbacks after a prompt has been queued
          // e.g. random seed after every gen
          executeWidgetsCallback(queuedNodes, 'afterQueued', {
            isPartialExecution
          })
          for (const node of queuedNodes) {
            applyPromotedWidgetControl(node, 'afterQueued')
          }
          useFreeTierQuota().trackRun()
          this.canvas.draw(true, true)
          await this.ui.queue.update()
        }

        if (queuedCount > 0) {
          api.dispatchCustomEvent('promptQueued', {
            number,
            batchCount: queuedCount,
            requestId
          })
        }
      }
    } finally {
      this.processingQueue = false
    }
    return queueResultOverride ?? !executionErrorStore.lastNodeErrors
  }

  showErrorOnFileLoad(file: File) {
    useToastStore().addAlert(
      t('toastMessages.fileLoadError', { fileName: file.name })
    )
  }

  /**
   * Loads workflow data from the specified file
   * @param {File} file
   */
  async handleFile(
    file: File,
    openSource?: WorkflowOpenSource,
    options?: {
      deferWarnings?: boolean
      onNodeCreated?: (node: LGraphNode) => void
    }
  ) {
    const fileName = file.name.replace(/\.\w+$/, '') // Strip file extension
    const workflowData = await getWorkflowDataFromFile(file)
    const { workflow, prompt, parameters, templates } = workflowData ?? {}

    if (!(workflow || prompt || parameters || templates)) {
      const mediaNodeTypes: Record<string, [string, typeof pasteImageNode]> = {
        image: ['LoadImage', pasteImageNode],
        audio: ['LoadAudio', pasteAudioNode],
        video: ['LoadVideo', pasteVideoNode]
      }

      const mediaType = Object.keys(mediaNodeTypes).find((t) =>
        file.type.startsWith(t)
      )
      if (mediaType) {
        const [nodeType, pasteFn] = mediaNodeTypes[mediaType]
        const transfer = new DataTransfer()
        transfer.items.add(file)
        const node = await createNode(this.canvas, nodeType)
        await pasteFn(this.canvas, transfer.items, node)
        if (node) options?.onNodeCreated?.(node)
        return
      }

      if (isMeshModelFile(file)) {
        const node = await this.handleMeshFile(file)
        if (node) options?.onNodeCreated?.(node)
        return
      }

      this.showErrorOnFileLoad(file)
      return
    }

    if (
      templates &&
      typeof templates === 'object' &&
      Array.isArray(templates)
    ) {
      this.loadTemplateData({
        templates: templates as { name?: string; data?: string }[]
      })
    }

    // Check workflow first - it should take priority over parameters
    // when both are present (e.g., in ComfyUI-generated PNGs)
    if (workflow) {
      let workflowObj: ComfyWorkflowJSON | undefined = undefined
      try {
        workflowObj =
          typeof workflow === 'string'
            ? parseJsonWithNonFinite<ComfyWorkflowJSON>(workflow)
            : (workflow as ComfyWorkflowJSON)

        // Only load workflow if parsing succeeded AND validation passed
        if (
          workflowObj &&
          typeof workflowObj === 'object' &&
          !Array.isArray(workflowObj)
        ) {
          await this.loadGraphData(workflowObj, true, true, fileName, {
            openSource,
            deferWarnings: options?.deferWarnings
          })
          return
        } else {
          console.error(
            'Invalid workflow structure, trying parameters fallback'
          )
        }
      } catch (err) {
        console.error('Failed to parse workflow:', err)
        // Fall through to check parameters as fallback
      }
    }

    if (prompt) {
      try {
        const promptObj =
          typeof prompt === 'string'
            ? parseJsonWithNonFinite<ComfyApiWorkflow>(prompt)
            : prompt
        if (this.isApiJson(promptObj)) {
          await this.loadApiJson(promptObj, fileName, {
            deferWarnings: options?.deferWarnings
          })
          return
        }
      } catch (err) {
        console.error('Failed to parse prompt:', err)
      }
      // Fall through to parameters as a last resort
    }

    // Use parameters strictly as the final fallback
    if (parameters && typeof parameters === 'string') {
      const outcome = await importA1111(
        this.rootGraph,
        parameters,
        async () => {
          try {
            // false: final destination; no later load republishes the hash.
            useWorkflowService().beforeLoadNewGraph(false)
            await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')
            await useExtensionService().invokeExtensionsAsync(
              'beforeConfigureGraph',
              this.rootGraph,
              parameters
            )
          } finally {
            useMissingNodesErrorStore().setMissingNodeTypes([])
          }
          this.canvas.setGraph(this.rootGraph)
        }
      )
      switch (outcome) {
        case 'core-nodes-unavailable':
          useToastStore().addAlert(t('toastMessages.a1111CoreNodesUnavailable'))
          return
        case 'not-a1111':
          this.showErrorOnFileLoad(file)
          return
        case 'imported-without-embeddings':
          useToastStore().add({
            severity: 'warn',
            summary: t('g.warning'),
            detail: t('toastMessages.a1111EmbeddingsUnavailable')
          })
          break
        case 'imported':
          break
        default: {
          const unexpectedOutcome: never = outcome
          throw new Error(
            `Unhandled A1111 import outcome: ${unexpectedOutcome}`
          )
        }
      }
      await useExtensionService().invokeExtensionsAsync(
        'afterConfigureGraph',
        parameters,
        undefined,
        this.rootGraph
      )
      await useWorkflowService().afterLoadNewGraph(
        fileName,
        this.rootGraph.serialize() as unknown as ComfyWorkflowJSON
      )
      await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
      return
    }

    this.showErrorOnFileLoad(file)
  }

  /**
   * Uploads a mesh model file and creates a Load3DAdvanced node displaying it
   * @param {File} file
   */
  private async handleMeshFile(file: File): Promise<LGraphNode | null> {
    // Refuse before uploading: the refusal otherwise lands after the file
    // is already on the server.
    if (isSelectOnly(this.canvas)) return null
    const uploadedPath = await Load3dUtils.uploadFile(file, '3d')
    if (!uploadedPath) return null

    const node = await createNode(this.canvas, 'Load3DAdvanced')
    if (!node) return null

    const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
    if (!modelWidget) return node

    const values = (modelWidget.options as { values?: string[] } | undefined)
      ?.values
    if (values && !values.includes(uploadedPath)) {
      values.push(uploadedPath)
    }
    modelWidget.value = uploadedPath
    return node
  }

  /**
   * Loads multiple files, connects to a batch node, and selects them
   * @param {FileList} fileList
   */
  async handleFileList(fileList: File[]) {
    if (fileList.length === 0) return
    if (!fileList[0].type.startsWith('image')) return

    const imageNodes = await pasteImageNodes(this.canvas, fileList)
    if (imageNodes.length === 0) return

    if (imageNodes.length > 1) {
      const batchImagesNode = await createNode(this.canvas, 'BatchImagesNode')
      if (!batchImagesNode) return

      this.positionBatchNodes(imageNodes, batchImagesNode)
      this.canvas.selectItems([...imageNodes, batchImagesNode])

      imageNodes.forEach((imageNode, index) => {
        imageNode.connect(0, batchImagesNode, index)
      })
    } else {
      this.canvas.selectItems(imageNodes)
    }
  }

  async handleAudioFileList(fileList: File[]) {
    const audioNodes = await pasteAudioNodes(this.canvas, fileList)
    if (audioNodes.length === 0) return

    this.positionNodes(audioNodes)
    this.canvas.selectItems(audioNodes)
  }

  async handleVideoFileList(fileList: File[]) {
    const videoNodes = await pasteVideoNodes(this.canvas, fileList)
    if (videoNodes.length === 0) return

    this.positionNodes(videoNodes)
    this.canvas.selectItems(videoNodes)
  }

  /**
   * Positions batched nodes in drag and drop
   * @param nodes
   * @param batchNode
   */
  positionNodes(nodes: LGraphNode[]): void {
    if (nodes.length <= 1) return

    const [x, y] = nodes[0].getBounding()
    const nodeHeight = 150

    nodes.forEach((node, index) => {
      if (index > 0) {
        node.pos = [x, y + nodeHeight * index + 25 * (index + 1)]
      }
    })

    this.canvas.graph?.change()
  }

  positionBatchNodes(nodes: LGraphNode[], batchNode: LGraphNode): void {
    const [x, y, width] = nodes[0].getBounding()
    batchNode.pos = [x + width + 100, y + 30]

    // Retrieving Node Height is inconsistent
    let height = 0
    if (nodes[0].type === 'LoadImage') {
      height = 344
    }

    nodes.forEach((node, index) => {
      if (index > 0) {
        node.pos = [x, y + height * index + 25 * (index + 1)]
      }
    })

    this.canvas.graph?.change()
  }

  // @deprecated
  isApiJson(data: unknown): data is ComfyApiWorkflow {
    if (!_.isObject(data) || Array.isArray(data)) {
      return false
    }
    if (Object.keys(data).length === 0) return false

    return Object.values(data).every((node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        return false
      }

      const { class_type: classType, inputs } = node as Record<string, unknown>
      const inputsIsRecord = _.isObject(inputs) && !Array.isArray(inputs)
      return typeof classType === 'string' && inputsIsRecord
    })
  }

  async loadApiJson(
    apiData: ComfyApiWorkflow,
    fileName: string,
    options: { deferWarnings?: boolean } = {}
  ): Promise<void> {
    // false: no workflow load follows to republish the hash.
    useWorkflowService().beforeLoadNewGraph(false)
    await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')
    await useExtensionService().invokeExtensionsAsync(
      'beforeConfigureGraph',
      this.rootGraph,
      apiData
    )
    this.canvas.setGraph(this.rootGraph)
    this.clean()

    const ids = Object.keys(apiData)
    // Export (API) flattens subgraph nodes to ids like "194:45". At the root
    // graph a colon reads as an execution-id path: Locate walks into node
    // 194's subgraph and finds nothing, and deleting an unrelated node 194
    // retires every "194:"-prefixed missing report. Remap such ids to
    // colon-free local ids before creating nodes.
    const importedNodeIds = new Map<string, NodeId>()
    {
      const taken = new Set(ids.filter((id) => !id.includes(':')))
      for (const id of ids) {
        if (!id.includes(':')) {
          importedNodeIds.set(id, toNodeId(isNaN(+id) ? id : +id))
          continue
        }
        let candidate = id.replaceAll(':', '_')
        while (taken.has(candidate)) candidate = `${candidate}_`
        taken.add(candidate)
        importedNodeIds.set(id, toNodeId(candidate))
      }
    }
    const missingNodeTypes: MissingNodeType[] = []
    const nodeReplacementStore = useNodeReplacementStore()
    await nodeReplacementStore.load()
    for (const id of ids) {
      const data = apiData[id]
      const nodeId = importedNodeIds.get(id) ?? toNodeId(id)
      let node = LiteGraph.createNode(data.class_type)
      let placeholderEntry:
        | Extract<MissingNodeType, { type: string }>
        | undefined
      if (!node) {
        const missingNode = new LGraphNode(
          data._meta?.title ?? data.class_type,
          sanitizeNodeName(data.class_type)
        )
        node = missingNode
        node.has_errors = true
        const widgetValues: TWidgetValue[] = []
        const widgetValuesNamed: Record<string, TWidgetValue> =
          Object.create(null)
        for (const [input, value] of Object.entries(data.inputs ?? {})) {
          if (value instanceof Array) {
            node.addInput(input, '*')
          } else {
            const widgetValue = unwrapExportedWidgetValue(value) as TWidgetValue
            widgetValues.push(widgetValue)
            widgetValuesNamed[input] = widgetValue
          }
        }
        node.last_serialization = {
          id: nodeId,
          type: data.class_type,
          pos: [node.pos[0], node.pos[1]],
          size: [node.size[0], node.size[1]],
          flags: {},
          order: 0,
          mode: node.mode,
          title: data._meta?.title ?? data.class_type,
          inputs: node.inputs.map((input, i) =>
            inputAsSerialisable(input, missingNode, i)
          ),
          widgets_values: widgetValues,
          widgets_values_named: widgetValuesNamed
        }
        const replacement = nodeReplacementStore.getReplacementFor(
          data.class_type
        )
        placeholderEntry = {
          type: data.class_type,
          isReplaceable: replacement !== null,
          replacement: replacement ?? undefined
        }
        missingNodeTypes.push(placeholderEntry)
      }
      node.id = nodeId
      node.title = data._meta?.title ?? node.title
      app.rootGraph.add(node)
      if (placeholderEntry && node.last_serialization) {
        node.last_serialization.id = node.id
        placeholderEntry.nodeId = String(node.id)
      }
    }

    const processNodeInputs = (id: string) => {
      const data = apiData[id]
      const currentNodeId = importedNodeIds.get(id) ?? toNodeId(id)
      const node = app.rootGraph.getNodeById(currentNodeId)
      if (!node) return

      for (const input in data.inputs ?? {}) {
        const value = data.inputs[input]
        if (value instanceof Array) {
          const [fromId, fromSlot] = value
          const fromNode = app.rootGraph.getNodeById(
            importedNodeIds.get(String(fromId)) ?? toNodeId(fromId)
          )
          if (!fromNode) continue

          let toSlot = node.inputs?.findIndex((inp) => inp.name === input) ?? -1
          if (toSlot === -1) {
            try {
              const widget = node.widgets?.find((w) => w.name === input)
              const convertFn = (
                node as LGraphNode & {
                  convertWidgetToInput?: (w: IBaseWidget) => boolean
                }
              ).convertWidgetToInput
              if (widget && convertFn?.(widget)) {
                // Re-find the target slot by name after conversion
                toSlot =
                  node.inputs?.findIndex((inp) => inp.name === input) ?? -1
              }
            } catch (_error) {
              // Ignore conversion errors
            }
          }
          if (toSlot !== -1) {
            fromNode.connect(fromSlot, node, toSlot)
          }
        } else {
          const widget = node.widgets?.find((w) => w.name === input)
          if (widget) {
            const widgetValue = unwrapExportedWidgetValue(value) as TWidgetValue
            widget.value = widgetValue
            widget.callback?.(widgetValue)
          }
        }
      }
      if (node.last_serialization) {
        node.last_serialization.inputs = node.inputs.map((input, i) =>
          inputAsSerialisable(input, node, i)
        )
      }
    }

    for (const id of ids) processNodeInputs(id)
    app.rootGraph.arrange()
    for (const id of ids) processNodeInputs(id)
    app.rootGraph.arrange()
    await useExtensionService().invokeExtensionsAsync(
      'afterConfigureGraph',
      apiData,
      undefined,
      this.rootGraph
    )

    await useWorkflowService().afterLoadNewGraph(
      fileName,
      this.rootGraph.serialize() as unknown as ComfyWorkflowJSON
    )
    await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
    if (missingNodeTypes.length) {
      this.showMissingNodesError(missingNodeTypes, options)
    }
  }

  /**
   * Registers a Comfy web extension with the app
   * @param {ComfyExtension} extension
   */
  registerExtension(extension: ComfyExtension) {
    useExtensionService().registerExtension(extension)
  }

  /**
   * Collects context menu items from all extensions for canvas menus
   * @param canvas The canvas instance
   * @returns Array of context menu items from all extensions
   */
  collectCanvasMenuItems(canvas: LGraphCanvas): IContextMenuValue[] {
    return useExtensionService()
      .invokeExtensions('getCanvasMenuItems', canvas)
      .flat() as IContextMenuValue[]
  }

  /**
   * Collects context menu items from all extensions for node menus
   * @param node The node being right-clicked
   * @returns Array of context menu items from all extensions
   */
  collectNodeMenuItems(node: LGraphNode): IContextMenuValue[] {
    return useExtensionService()
      .invokeExtensions('getNodeMenuItems', node)
      .flat() as IContextMenuValue[]
  }

  /**
   * Reload node definitions and refresh combo lists on all nodes.
   */
  async reloadNodeDefs() {
    const defs = await this.getNodeDefs()
    for (const nodeId in defs) {
      this.registerNodeDef(nodeId, defs[nodeId])
    }
    // Refresh combo widgets in all nodes including those in subgraphs
    const nodeOutputStore = useNodeOutputStore()
    forEachNode(this.rootGraph, (node) => {
      const def = defs[node.type]
      // Allow primitive nodes to handle refresh
      node.refreshComboInNode?.(defs)

      if (!def?.input) return

      if (node.widgets) {
        const nodeInputs = def.input
        for (const widget of node.widgets) {
          if (widget.type === 'combo') {
            let inputType: 'required' | 'optional' | undefined
            if (nodeInputs.required?.[widget.name] !== undefined) {
              inputType = 'required'
            } else if (nodeInputs.optional?.[widget.name] !== undefined) {
              inputType = 'optional'
            }
            if (inputType !== undefined) {
              // Get the input spec associated with the widget
              const inputSpec = nodeInputs[inputType]?.[widget.name]
              if (inputSpec) {
                // Refresh the combo widget's options with the values from the input spec
                if (isComboInputSpecV2(inputSpec)) {
                  widget.options.values = inputSpec[1]?.options
                } else if (isComboInputSpecV1(inputSpec)) {
                  widget.options.values = inputSpec[0]
                }
              }
            }
          }
        }
      }

      // Re-trigger previews on media nodes (e.g. LoadImage)
      // to bust browser cache when files are edited externally
      if (isImageNode(node) || isVideoNode(node)) {
        nodeOutputStore.refreshNodeOutputs(node)
      }
    })

    await useExtensionService().invokeExtensionsAsync(
      'refreshComboInNodes',
      defs
    )

    // Promoted widgets keep hosted option snapshots; sync them after source refresh hooks run.
    syncPromotedComboHostOptions(this.rootGraph)

    if (this.vueAppReady) {
      this.updateVueAppNodeDefs(defs)
    }
  }

  /**
   * Refresh combo list on whole nodes
   */
  async refreshComboInNodes() {
    const requestToastMessage: ToastMessageOptions = {
      severity: 'info',
      summary: t('g.update'),
      detail: t('toastMessages.updateRequested')
    }
    if (this.vueAppReady) {
      useToastStore().add(requestToastMessage)
    }

    try {
      await this.reloadNodeDefs()

      if (this.vueAppReady) {
        useToastStore().add({
          severity: 'success',
          summary: t('g.updated'),
          detail: t('toastMessages.nodeDefinitionsUpdated'),
          life: 1000
        })
      }
    } catch (error) {
      if (this.vueAppReady) {
        useToastStore().add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('toastMessages.nodeDefinitionsUpdateFailed')
        })
      }
      throw error
    } finally {
      if (this.vueAppReady) {
        useToastStore().remove(requestToastMessage)
      }
    }
  }

  /**
   * Clean current state
   */
  clean() {
    const nodeOutputStore = useNodeOutputStore()
    nodeOutputStore.resetAllOutputsAndPreviews()
    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.clearRunErrors()
    useMissingNodesErrorStore().setMissingNodeTypes([])

    useDomWidgetStore().clear()

    // Subgraph does not properly implement `clear` and the parent class's
    // (`LGraph`) `clear` breaks the subgraph structure.
    if (this.rootGraph && !this.canvas.subgraph) {
      this.rootGraph.clear()
    }
  }

  clientPosToCanvasPos(pos: Vector2): Vector2 {
    if (!this.positionConversion) {
      throw new Error('clientPosToCanvasPos called before setup')
    }
    return this.positionConversion.clientPosToCanvasPos(pos)
  }

  canvasPosToClientPos(pos: Vector2): Vector2 {
    if (!this.positionConversion) {
      throw new Error('canvasPosToClientPos called before setup')
    }
    return this.positionConversion.canvasPosToClientPos(pos)
  }
}

export const app = new ComfyApp()
