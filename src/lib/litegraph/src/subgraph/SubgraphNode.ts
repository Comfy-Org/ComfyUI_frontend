import type { BaseLGraph, LGraph, SubgraphId } from '@/lib/litegraph/src/LGraph'
import type { LGraphButton } from '@/lib/litegraph/src/LGraphButton'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { DrawTitleBoxOptions } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { ResolvedConnection } from '@/lib/litegraph/src/LLink'
import { NullGraphError } from '@/lib/litegraph/src/infrastructure/NullGraphError'
import { RecursionError } from '@/lib/litegraph/src/infrastructure/RecursionError'
import type {
  ISubgraphInput,
  IWidgetLocator
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  ISlotType,
  NodeId
} from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
import type {
  GraphOrSubgraph,
  Subgraph
} from '@/lib/litegraph/src/subgraph/Subgraph'
import type {
  ExportedSubgraphInstance,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import {
  createPromotedWidgetView,
  getPromotedWidgetHostStateName,
  isPromotedWidgetView
} from '@/core/graph/subgraph/promotedWidgetView'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  supportsVirtualCanvasImagePreview
} from '@/composables/node/canvasImagePreviewTypes'
import { parsePreviewExposures } from '@/core/schemas/previewExposureSchema'
import { parseProxyWidgetErrorQuarantine } from '@/core/schemas/proxyWidgetQuarantineSchema'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { ExecutableNodeDTO } from './ExecutableNodeDTO'
import type { ExecutableLGraphNode, ExecutionId } from './ExecutableNodeDTO'
import { PromotedWidgetViewManager } from './PromotedWidgetViewManager'
import type { SubgraphInput } from './SubgraphInput'
import { createBitmapCache } from './svgBitmapCache'

const workflowSvg = new Image()
workflowSvg.src =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='16' height='16'%3E%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='white' stroke-linecap='round' stroke-width='1.3' d='M9.18613 3.09999H6.81377M9.18613 12.9H7.55288c-3.08678 0-5.35171-2.99581-4.60305-6.08843l.3054-1.26158M14.7486 2.1721l-.5931 2.45c-.132.54533-.6065.92789-1.1508.92789h-2.2993c-.77173 0-1.33797-.74895-1.1508-1.5221l.5931-2.45c.132-.54533.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.74896 1.1508 1.52211Zm-8.3033 0-.59309 2.45c-.13201.54533-.60646.92789-1.15076.92789H2.4021c-.7717 0-1.33793-.74895-1.15077-1.5221l.59309-2.45c.13201-.54533.60647-.9279 1.15077-.9279h2.29935c.77169 0 1.33792.74896 1.15076 1.52211Zm8.3033 9.8-.5931 2.45c-.132.5453-.6065.9279-1.1508.9279h-2.2993c-.77173 0-1.33797-.749-1.1508-1.5221l.5931-2.45c.132-.5453.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.7489 1.1508 1.5221Z'/%3E%3C/svg%3E %3C/svg%3E"

type LinkedPromotionEntry = PromotedWidgetSource & {
  inputName: string
  inputKey: string
  /** The subgraph input slot's internal name (stable identity). */
  slotName: string
}
// Pre-rasterize the SVG to a bitmap canvas to avoid Firefox re-processing
// the SVG's internal stylesheet on every ctx.drawImage() call per frame.
const workflowBitmapCache = createBitmapCache(workflowSvg, 32)

function isWidgetValue(value: unknown): value is TWidgetValue {
  if (value === undefined) return true
  if (typeof value === 'string') return true
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return true
  return value !== null && typeof value === 'object'
}

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 */
export class SubgraphNode extends LGraphNode implements BaseLGraph {
  declare inputs: (INodeInputSlot & Partial<ISubgraphInput>)[]

  override readonly type: SubgraphId
  override readonly isVirtualNode = true as const
  override graph: GraphOrSubgraph | null

  get rootGraph(): LGraph {
    if (!this.graph)
      throw new NullGraphError(`SubgraphNode ${this.id} has no graph`)
    return this.graph.rootGraph
  }

  override get displayType(): string {
    return 'Subgraph node'
  }

  override isSubgraphNode(): this is SubgraphNode {
    return true
  }

  private _promotedViewManager =
    new PromotedWidgetViewManager<PromotedWidgetView>()
  private _cacheVersion = 0
  private _linkedEntriesCache?: {
    version: number
    inputOrderKey: string
    hasMissingBoundSourceWidget: boolean
    entries: LinkedPromotionEntry[]
  }
  private _promotedViewsCache?: {
    version: number
    inputOrderKey: string
    hasMissingBoundSourceWidget: boolean
    views: PromotedWidgetView[]
  }

  // Declared as accessor via Object.defineProperty in constructor.
  // TypeScript doesn't allow overriding a property with get/set syntax,
  // so we use declare + defineProperty instead.
  declare widgets: IBaseWidget[]

  private _resolveLinkedPromotionBySubgraphInput(
    subgraphInput: SubgraphInput
  ): PromotedWidgetSource | undefined {
    // Preserve deterministic representative selection for multi-linked inputs:
    // the first connected source remains the promoted linked view.
    for (const linkId of subgraphInput.linkIds) {
      const link = this.subgraph.getLink(linkId)
      if (!link) continue

      const { inputNode } = link.resolve(this.subgraph)
      if (!inputNode || !Array.isArray(inputNode.inputs)) continue

      const targetInput = inputNode.inputs.find(
        (entry) => entry.link === linkId
      )
      if (!targetInput) continue

      const targetWidget = inputNode.getWidgetFromSlot(targetInput)
      if (!targetWidget) continue

      if (inputNode.isSubgraphNode()) {
        // ADR 0009: each SubgraphNode is opaque. The promoted source on the
        // parent host always references the immediate child's input slot, not
        // the deeper leaf widget identity that the child internally exposes.
        return {
          sourceNodeId: String(inputNode.id),
          sourceWidgetName: targetInput.name
        }
      }

      return {
        sourceNodeId: String(inputNode.id),
        sourceWidgetName: targetWidget.name
      }
    }
  }

  private _getLinkedPromotionEntries(cache = true): LinkedPromotionEntry[] {
    const hasMissingBoundSourceWidget = this._hasMissingBoundSourceWidget()
    const inputOrderKey = this._getInputOrderKey()
    const cached = this._linkedEntriesCache
    if (
      cache &&
      cached?.version === this._cacheVersion &&
      cached.inputOrderKey === inputOrderKey &&
      cached.hasMissingBoundSourceWidget === hasMissingBoundSourceWidget
    )
      return cached.entries

    const linkedEntries: LinkedPromotionEntry[] = []

    for (const input of this.inputs) {
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) continue

      const boundWidget =
        input._widget && isPromotedWidgetView(input._widget)
          ? input._widget
          : undefined
      if (boundWidget) {
        const boundNode = this.subgraph.getNodeById(boundWidget.sourceNodeId)
        const hasBoundSourceWidget =
          boundNode?.widgets?.some(
            (widget) => widget.name === boundWidget.sourceWidgetName
          ) === true
        if (hasBoundSourceWidget) {
          linkedEntries.push({
            inputName: input.label ?? input.name,
            inputKey: String(subgraphInput.id),
            slotName: subgraphInput.name,
            sourceNodeId: boundWidget.sourceNodeId,
            sourceWidgetName: boundWidget.sourceWidgetName
          })
          continue
        }
      }

      const resolved =
        this._resolveLinkedPromotionBySubgraphInput(subgraphInput)
      if (!resolved) continue

      linkedEntries.push({
        inputName: input.label ?? input.name,
        inputKey: String(subgraphInput.id),
        slotName: subgraphInput.name,
        ...resolved
      })
    }

    const seenEntryKeys = new Set<string>()
    const deduplicatedEntries = linkedEntries.filter((entry) => {
      const entryKey = this._makePromotionViewKey(
        entry.inputKey,
        entry.sourceNodeId,
        entry.sourceWidgetName,
        entry.inputName
      )
      if (seenEntryKeys.has(entryKey)) return false

      seenEntryKeys.add(entryKey)
      return true
    })

    if (cache)
      this._linkedEntriesCache = {
        version: this._cacheVersion,
        inputOrderKey,
        hasMissingBoundSourceWidget,
        entries: deduplicatedEntries
      }

    return deduplicatedEntries
  }

  private _hasMissingBoundSourceWidget(): boolean {
    return this.inputs.some((input) => {
      const boundWidget =
        input._widget && isPromotedWidgetView(input._widget)
          ? input._widget
          : undefined
      if (!boundWidget) return false

      const boundNode = this.subgraph.getNodeById(boundWidget.sourceNodeId)
      return (
        boundNode?.widgets?.some(
          (widget) => widget.name === boundWidget.sourceWidgetName
        ) !== true
      )
    })
  }

  private _getPromotedViews(): PromotedWidgetView[] {
    const hasMissingBoundSourceWidget = this._hasMissingBoundSourceWidget()
    const inputOrderKey = this._getInputOrderKey()
    const cachedViews = this._promotedViewsCache
    if (
      cachedViews?.version === this._cacheVersion &&
      cachedViews.inputOrderKey === inputOrderKey &&
      cachedViews.hasMissingBoundSourceWidget === hasMissingBoundSourceWidget
    )
      return cachedViews.views

    const linkedEntries = this._getLinkedPromotionEntries()
    const displayNameByViewKey = this._buildDisplayNameByViewKey(linkedEntries)
    const reconcileEntries = this._buildLinkedReconcileEntries(linkedEntries)

    const views = this._promotedViewManager.reconcile(
      reconcileEntries,
      (entry) =>
        createPromotedWidgetView(
          this,
          entry.sourceNodeId,
          entry.sourceWidgetName,
          entry.viewKey ? displayNameByViewKey.get(entry.viewKey) : undefined,
          entry.slotName
        )
    )

    this._promotedViewsCache = {
      version: this._cacheVersion,
      inputOrderKey,
      hasMissingBoundSourceWidget,
      views
    }

    return views
  }

  private _getInputOrderKey(): string {
    return this.inputs
      .map((input) => input._subgraphSlot?.id ?? input.name)
      .join('|')
  }

  private _invalidatePromotedViewsCache(): void {
    this._cacheVersion++
  }

  private _buildLinkedReconcileEntries(
    linkedEntries: LinkedPromotionEntry[]
  ): Array<{
    sourceNodeId: string
    sourceWidgetName: string
    viewKey: string
    slotName: string
  }> {
    return linkedEntries.map(
      ({ inputKey, inputName, slotName, sourceNodeId, sourceWidgetName }) => ({
        sourceNodeId,
        sourceWidgetName,
        slotName,
        viewKey: this._makePromotionViewKey(
          inputKey,
          sourceNodeId,
          sourceWidgetName,
          inputName
        )
      })
    )
  }

  private _buildDisplayNameByViewKey(
    linkedEntries: LinkedPromotionEntry[]
  ): Map<string, string> {
    return new Map(
      linkedEntries.map((entry) => [
        this._makePromotionViewKey(
          entry.inputKey,
          entry.sourceNodeId,
          entry.sourceWidgetName,
          entry.inputName
        ),
        entry.inputName
      ])
    )
  }

  private _makePromotionViewKey(
    inputKey: string,
    sourceNodeId: string,
    sourceWidgetName: string,
    inputName = ''
  ): string {
    return JSON.stringify([inputKey, sourceNodeId, sourceWidgetName, inputName])
  }

  /** Manages lifecycle of all subgraph event listeners */
  private _eventAbortController = new AbortController()

  constructor(
    /** The (sub)graph that contains this subgraph instance. */
    graph: GraphOrSubgraph,
    /** The definition of this subgraph; how its nodes are configured, etc. */
    readonly subgraph: Subgraph,
    instanceData: ExportedSubgraphInstance
  ) {
    super(subgraph.name, subgraph.id)
    this.graph = graph

    // Synthetic widgets getter — SubgraphNodes have no native widgets.
    Object.defineProperty(this, 'widgets', {
      get: () => this._getPromotedViews(),
      set: () => {
        if (import.meta.env.DEV)
          console.warn(
            'Cannot manually set widgets on SubgraphNode; use the promotion system.'
          )
      },
      configurable: true,
      enumerable: true
    })

    // Update this node when the subgraph input / output slots are changed
    const subgraphEvents = this.subgraph.events
    const { signal } = this._eventAbortController

    subgraphEvents.addEventListener(
      'input-added',
      (e) => {
        const subgraphInput = e.detail.input
        const { name, type } = subgraphInput
        const existingInput = this.inputs.find(
          (input) =>
            input._subgraphSlot === subgraphInput ||
            (input._subgraphSlot && input._subgraphSlot.id === subgraphInput.id)
        )
        if (existingInput) {
          // Rebind to the new SubgraphInput object and re-register listeners
          // (configure recreates SubgraphInput objects with the same id)
          this._addSubgraphInputListeners(subgraphInput, existingInput)
          const linkId = subgraphInput.linkIds[0]
          if (linkId === undefined) return

          const link = this.subgraph.getLink(linkId)
          if (!link) return

          const { inputNode, input } = link.resolve(subgraph)
          if (!inputNode || !input) return

          const widget = inputNode.getWidgetFromSlot(input)
          if (widget)
            this._setWidget(
              subgraphInput,
              existingInput,
              widget,
              input.widget,
              inputNode
            )
          return
        }
        const input = this.addInput(name, type, {
          _subgraphSlot: subgraphInput
        })
        this._invalidatePromotedViewsCache()

        this._addSubgraphInputListeners(subgraphInput, input)
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'removing-input',
      (e) => {
        const widget = e.detail.input._widget
        if (widget) this.ensureWidgetRemoved(widget)

        this.removeInput(e.detail.index)
        this._invalidatePromotedViewsCache()
        this.setDirtyCanvas(true, true)
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'output-added',
      (e) => {
        const { name, type } = e.detail.output
        this.addOutput(name, type)
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'removing-output',
      (e) => {
        this.removeOutput(e.detail.index)
        this.setDirtyCanvas(true, true)
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'renaming-input',
      (e) => {
        const { index, newName } = e.detail
        const input = this.inputs.at(index)
        if (!input) throw new Error('Subgraph input not found')

        input.label = newName
        // Do NOT change input.widget.name — it is the stable internal
        // identifier used by onGraphConfigured (widgetInputs.ts) to match
        // inputs to widgets. Changing it to the display label would cause
        // collisions when two promoted inputs share the same label.
        // Display is handled via input.label and _widget.label.
        if (input._widget) input._widget.label = newName
        this._invalidatePromotedViewsCache()
        this.graph?.trigger('node:slot-label:changed', {
          nodeId: this.id,
          slotType: NodeSlotType.INPUT
        })
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'renaming-output',
      (e) => {
        const { index, newName } = e.detail
        const output = this.outputs.at(index)
        if (!output) throw new Error('Subgraph output not found')

        output.label = newName
        this.graph?.trigger('node:slot-label:changed', {
          nodeId: this.id,
          slotType: NodeSlotType.OUTPUT
        })
      },
      { signal }
    )

    this.type = subgraph.id
    this.configure(instanceData)

    this.addTitleButton({
      name: 'enter_subgraph',
      text: '\uE93B', // Unicode for pi-window-maximize
      yOffset: 0, // No vertical offset needed, button is centered
      xOffset: -10,
      fontSize: 16
    })
  }

  override onTitleButtonClick(
    button: LGraphButton,
    canvas: LGraphCanvas
  ): void {
    if (button.name === 'enter_subgraph') {
      canvas.openSubgraph(this.subgraph, this)
    } else {
      super.onTitleButtonClick(button, canvas)
    }
  }

  private _addSubgraphInputListeners(
    subgraphInput: SubgraphInput,
    input: INodeInputSlot & Partial<ISubgraphInput>
  ) {
    input._subgraphSlot = subgraphInput

    if (
      input._listenerController &&
      typeof input._listenerController.abort === 'function'
    ) {
      input._listenerController.abort()
    }
    input._listenerController = new AbortController()
    const { signal } = input._listenerController

    subgraphInput.events.addEventListener(
      'input-connected',
      (e) => {
        this._invalidatePromotedViewsCache()
        input.shape = this.getSlotShape(subgraphInput, e.detail.input)
        if (!e.detail.widget || !e.detail.node) return

        // `SubgraphInput.connect()` dispatches before appending to `linkIds`,
        // so resolve by current links would miss this new connection.
        // Keep the earliest bound view once present, and only bind from event
        // payload when this input has no representative yet.
        const boundWidget =
          input._widget && isPromotedWidgetView(input._widget)
            ? input._widget
            : undefined
        const hasStaleBoundWidget =
          boundWidget &&
          this.subgraph
            .getNodeById(boundWidget.sourceNodeId)
            ?.widgets?.some(
              (widget) => widget.name === boundWidget.sourceWidgetName
            ) !== true

        const shouldSetWidgetFromEvent = !input._widget || hasStaleBoundWidget
        if (shouldSetWidgetFromEvent)
          this._setWidget(
            subgraphInput,
            input,
            e.detail.widget,
            e.detail.input.widget,
            e.detail.node
          )

        this._invalidatePromotedViewsCache()
      },
      { signal }
    )

    subgraphInput.events.addEventListener(
      'input-disconnected',
      () => {
        this._invalidatePromotedViewsCache()
        input.shape = this.getSlotShape(subgraphInput)

        // If links remain, rebind to the current representative.
        const connectedWidgets = subgraphInput.getConnectedWidgets()
        if (connectedWidgets.length > 0) {
          this._resolveInputWidget(subgraphInput, input)
          this._invalidatePromotedViewsCache()
          return
        }

        if (input._widget) this.ensureWidgetRemoved(input._widget)

        delete input.pos
        delete input.widget
        input._widget = undefined
        this._invalidatePromotedViewsCache()
      },
      { signal }
    )
  }

  private _rebindInputSubgraphSlots(): void {
    this._invalidatePromotedViewsCache()

    const subgraphSlots = [...this.subgraph.inputNode.slots]
    const slotsBySignature = new Map<string, SubgraphInput[]>()
    const slotsByName = new Map<string, SubgraphInput[]>()

    for (const slot of subgraphSlots) {
      const signature = `${slot.name}:${String(slot.type)}`
      const signatureSlots = slotsBySignature.get(signature)
      if (signatureSlots) {
        signatureSlots.push(slot)
      } else {
        slotsBySignature.set(signature, [slot])
      }

      const nameSlots = slotsByName.get(slot.name)
      if (nameSlots) {
        nameSlots.push(slot)
      } else {
        slotsByName.set(slot.name, [slot])
      }
    }

    const assignedSlotIds = new Set<string>()
    const takeUnassignedSlot = (
      slots: SubgraphInput[] | undefined
    ): SubgraphInput | undefined => {
      if (!slots) return undefined
      return slots.find((slot) => !assignedSlotIds.has(String(slot.id)))
    }

    for (const input of this.inputs) {
      const existingSlot = input._subgraphSlot
      if (
        existingSlot &&
        this.subgraph.inputNode.slots.some((slot) => slot === existingSlot)
      ) {
        assignedSlotIds.add(String(existingSlot.id))
        continue
      }

      const signature = `${input.name}:${String(input.type)}`
      const matchedSlot =
        takeUnassignedSlot(slotsBySignature.get(signature)) ??
        takeUnassignedSlot(slotsByName.get(input.name))

      if (matchedSlot) {
        input._subgraphSlot = matchedSlot
        assignedSlotIds.add(String(matchedSlot.id))
      } else {
        delete input._subgraphSlot
      }
    }
  }

  override configure(info: ExportedSubgraphInstance): void {
    for (const input of this.inputs) {
      if (
        input._listenerController &&
        typeof input._listenerController.abort === 'function'
      ) {
        input._listenerController.abort()
      }
    }

    this.inputs.length = 0
    this.inputs.push(
      ...this.subgraph.inputNode.slots.map((slot) =>
        Object.assign(
          new NodeInputSlot(
            {
              name: slot.name,
              localized_name: slot.localized_name,
              label: slot.label,
              shape: this.getSlotShape(slot),
              type: slot.type,
              link: null
            },
            this
          ),
          {
            _subgraphSlot: slot
          }
        )
      )
    )

    this.outputs.length = 0
    this.outputs.push(
      ...this.subgraph.outputNode.slots.map(
        (slot) =>
          new NodeOutputSlot(
            {
              name: slot.name,
              localized_name: slot.localized_name,
              label: slot.label,
              type: slot.type,
              links: null
            },
            this
          )
      )
    )

    super.configure(info)
    this._applyPromotedWidgetValues(info.widgets_values)
  }

  /**
   * Hydrate per-instance promoted widget values into this host's widget value
   * store entry. Routing through `PromotedWidgetView.set value` would cascade
   * into the shared interior widget, stomping every other SubgraphNode
   * instance that references the same shared interior.
   */
  private _applyPromotedWidgetValues(
    widgetValues: ExportedSubgraphInstance['widgets_values']
  ): void {
    if (!widgetValues) return
    // Transient clones created during clipboard duplicate go through
    // configure() with `id === -1` before being added to the graph.
    // Hydrating under id `-1` would poison `useWidgetValueStore` and
    // race with the eventual real instance for ownership of host state.
    if (this.id === -1) return

    let valueIndex = 0
    for (const input of this.inputs) {
      const view = input._widget
      if (!view || !isPromotedWidgetView(view)) continue
      if (valueIndex >= widgetValues.length) return
      const value = widgetValues[valueIndex]
      if (value !== undefined) view.hydrateHostValue(value)
      valueIndex += 1
    }
  }

  override _internalConfigureAfterSlots() {
    this._rebindInputSubgraphSlots()

    // Prune inputs that don't map to any subgraph slot definition.
    // This prevents stale/duplicate serialized inputs from persisting (#9977).
    this.inputs = this.inputs.filter((input) => input._subgraphSlot)

    // Clear view cache — forces re-creation on next getter access.
    this._promotedViewManager.clear()
    this._invalidatePromotedViewsCache()

    usePreviewExposureStore().setExposures(
      this.rootGraph.id,
      String(this.id),
      parsePreviewExposures(this.properties.previewExposures)
    )

    // Check all inputs for connected widgets
    for (const input of this.inputs) {
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) {
        // Skip inputs that don't exist in the subgraph definition
        // This can happen when loading workflows with dynamically added inputs
        console.warn(
          `[SubgraphNode.configure] No subgraph input found for input ${input.name}, skipping`
        )
        continue
      }

      this._addSubgraphInputListeners(subgraphInput, input)
      this._resolveInputWidget(subgraphInput, input)
    }

    this._invalidatePromotedViewsCache()

    for (const node of this.subgraph.nodes) {
      if (!supportsVirtualCanvasImagePreview(node)) continue
      const hostLocator = String(this.id)
      const previewStore = usePreviewExposureStore()
      const existing = previewStore
        .getExposures(this.rootGraph.id, hostLocator)
        .some(
          (exposure) =>
            exposure.sourceNodeId === String(node.id) &&
            exposure.sourcePreviewName === CANVAS_IMAGE_PREVIEW_WIDGET
        )
      if (existing) continue
      previewStore.addExposure(this.rootGraph.id, hostLocator, {
        sourceNodeId: String(node.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      })
    }
  }

  /**
   * Clears all cached promoted widget views and re-resolves `input._widget`
   * bindings from the current subgraph connections.  Called after ancestor
   * promotions are repointed during nested subgraph packing.
   */
  rebuildInputWidgetBindings(): void {
    this._promotedViewManager.clear()
    this._invalidatePromotedViewsCache()

    for (const input of this.inputs) {
      delete input.widget
      delete input.pos
      input._widget = undefined
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) continue
      this._resolveInputWidget(subgraphInput, input)
    }

    this._invalidatePromotedViewsCache()
  }

  private _resolveInputWidget(
    subgraphInput: SubgraphInput,
    input: INodeInputSlot
  ) {
    for (const linkId of subgraphInput.linkIds) {
      const link = this.subgraph.getLink(linkId)
      if (!link) {
        console.warn(
          `[SubgraphNode.configure] No link found for link ID ${linkId}`,
          this
        )
        continue
      }

      const { inputNode } = link.resolve(this.subgraph)
      if (!inputNode) {
        console.warn('Failed to resolve inputNode', link, this)
        continue
      }

      const targetInput = inputNode.inputs.find((inp) => inp.link === linkId)
      if (!targetInput) {
        console.warn('Failed to find corresponding input', link, inputNode)
        continue
      }

      const widget = inputNode.getWidgetFromSlot(targetInput)
      if (!widget) continue

      this._setWidget(
        subgraphInput,
        input,
        widget,
        targetInput.widget,
        inputNode
      )
      break
    }
  }

  /**
   * Binds a promoted widget view to a subgraph input slot.
   *
   * Creates or retrieves a {@link PromotedWidgetView}, registers it in the
   * promotion store, sets up the prototype chain for multi-level subgraph
   * nesting, and dispatches the `widget-promoted` event.
   */
  private _setWidget(
    subgraphInput: Readonly<SubgraphInput>,
    input: INodeInputSlot,
    interiorWidget: Readonly<IBaseWidget>,
    inputWidget: IWidgetLocator | undefined,
    interiorNode: LGraphNode
  ) {
    this._invalidatePromotedViewsCache()

    const nodeId = String(interiorNode.id)
    const widgetName = interiorWidget.name

    const previousView = input._widget

    if (
      previousView &&
      isPromotedWidgetView(previousView) &&
      (previousView.sourceNodeId !== nodeId ||
        previousView.sourceWidgetName !== widgetName)
    ) {
      this._removePromotedView(previousView)
    }

    // Create/retrieve the view from cache.
    // The cache key uses `input.name` (the slot's internal name) rather
    // than `subgraphInput.name` because nested subgraphs may remap
    // the internal name independently of the interior node.
    const view = this._promotedViewManager.getOrCreate(
      nodeId,
      widgetName,
      () =>
        createPromotedWidgetView(
          this,
          nodeId,
          widgetName,
          input.label ?? subgraphInput.name,
          subgraphInput.name
        ),
      this._makePromotionViewKey(
        String(subgraphInput.id),
        nodeId,
        widgetName,
        input.label ?? input.name
      )
    )

    // NOTE: This code creates linked chains of prototypes for passing across
    // multiple levels of subgraphs. As part of this, it intentionally avoids
    // creating new objects. Have care when making changes.
    // Use subgraphInput.name as the stable identity — unique per subgraph
    // slot, immune to label renames. Matches PromotedWidgetView.name.
    // Display is handled via widget.label / PromotedWidgetView.label.
    input.widget ??= { name: subgraphInput.name }
    input.widget.name = subgraphInput.name
    if (inputWidget) Object.setPrototypeOf(input.widget, inputWidget)

    input._widget = view

    // Dispatch widget-promoted event
    this.subgraph.events.dispatch('widget-promoted', {
      widget: view,
      subgraphNode: this
    })
  }

  override onAdded(_graph: LGraph): void {
    this._invalidatePromotedViewsCache()
  }

  /**
   * Ensures the subgraph slot is in the params before adding the input as normal.
   * @param name The name of the input slot.
   * @param type The type of the input slot.
   * @param inputProperties Properties that are directly assigned to the created input. Default: a new, empty object.
   * @returns The new input slot.
   * @remarks Assertion is required to instantiate empty generic POJO.
   */
  override addInput<TInput extends Partial<ISubgraphInput>>(
    name: string,
    type: ISlotType,
    inputProperties: TInput = {} as TInput
  ): INodeInputSlot & TInput {
    // Bypasses type narrowing on this.inputs
    return super.addInput(name, type, inputProperties)
  }

  override getSlotFromWidget(
    widget: IBaseWidget | undefined
  ): INodeInputSlot | undefined {
    if (!widget || !isPromotedWidgetView(widget))
      return super.getSlotFromWidget(widget)

    return this.inputs.find((input) => input._widget === widget)
  }

  override getWidgetFromSlot(slot: INodeInputSlot): IBaseWidget | undefined {
    if (slot._widget) return slot._widget
    return super.getWidgetFromSlot(slot)
  }

  override getInputLink(slot: number): LLink | null {
    // Output side: the link from inside the subgraph
    const innerLink = this.subgraph.outputNode.slots[slot].getLinks().at(0)
    if (!innerLink) {
      console.warn(
        `SubgraphNode.getInputLink: no inner link found for slot ${slot}`
      )
      return null
    }

    const newLink = LLink.create(innerLink)
    newLink.origin_id = `${this.id}:${innerLink.origin_id}`
    newLink.origin_slot = innerLink.origin_slot

    return newLink
  }

  /**
   * Finds the internal links connected to the given input slot inside the subgraph, and resolves the nodes / slots.
   * @param slot The slot index
   * @returns The resolved connections, or undefined if no input node is found.
   * @remarks This is used to resolve the input links when dragging a link from a subgraph input slot.
   */
  resolveSubgraphInputLinks(slot: number): ResolvedConnection[] {
    const inputSlot = this.subgraph.inputNode.slots[slot]
    const innerLinks = inputSlot.getLinks()
    if (innerLinks.length === 0) {
      console.warn(
        `[SubgraphNode.resolveSubgraphInputLinks] No inner links found for input slot [${slot}] ${inputSlot.name}`,
        this
      )
      return []
    }
    return innerLinks.map((link) => link.resolve(this.subgraph))
  }

  /**
   * Finds the internal link connected to the given output slot inside the subgraph, and resolves the nodes / slots.
   * @param slot The slot index
   * @returns The output node if found, otherwise undefined.
   */
  resolveSubgraphOutputLink(slot: number): ResolvedConnection | undefined {
    const outputSlot = this.subgraph.outputNode.slots[slot]
    const innerLink = outputSlot.getLinks().at(0)
    if (innerLink) {
      return innerLink.resolve(this.subgraph)
    }
    console.warn(
      `[SubgraphNode.resolveSubgraphOutputLink] No inner link found for output slot [${slot}] ${outputSlot.name}`,
      this
    )
  }

  /** @internal Used to flatten the subgraph before execution. */
  override getInnerNodes(
    /** The set of computed node DTOs for this execution. */
    executableNodes: Map<ExecutionId, ExecutableLGraphNode>,
    /** The path of subgraph node IDs. */
    subgraphNodePath: readonly NodeId[] = [],
    /** Internal recursion param. The list of nodes to add to. */
    nodes: ExecutableLGraphNode[] = [],
    /** Internal recursion param. The set of visited nodes. */
    visited = new Set<SubgraphNode>()
  ): ExecutableLGraphNode[] {
    if (visited.has(this)) {
      const nodeInfo = `${this.id}${this.title ? ` (${this.title})` : ''}`
      const subgraphInfo = `'${this.subgraph.name || 'Unnamed Subgraph'}'`
      const depth = subgraphNodePath.length
      throw new RecursionError(
        `Circular reference detected at depth ${depth} in node ${nodeInfo} of subgraph ${subgraphInfo}. ` +
          `This creates an infinite loop in the subgraph hierarchy.`
      )
    }
    visited.add(this)

    const subgraphInstanceIdPath = [...subgraphNodePath, this.id]

    // Store the subgraph node DTO
    const parentSubgraphNode = this.rootGraph
      .resolveSubgraphIdPath(subgraphNodePath)
      .at(-1)
    const subgraphNodeDto = new ExecutableNodeDTO(
      this,
      subgraphNodePath,
      executableNodes,
      parentSubgraphNode
    )
    executableNodes.set(subgraphNodeDto.id, subgraphNodeDto)

    for (const node of this.subgraph.nodes) {
      if ('getInnerNodes' in node && node.getInnerNodes) {
        node.getInnerNodes(
          executableNodes,
          subgraphInstanceIdPath,
          nodes,
          new Set(visited)
        )
      } else {
        // Create minimal DTOs rather than cloning the node
        const aVeryRealNode = new ExecutableNodeDTO(
          node,
          subgraphInstanceIdPath,
          executableNodes,
          this
        )
        executableNodes.set(aVeryRealNode.id, aVeryRealNode)
        nodes.push(aVeryRealNode)
      }
    }
    return nodes
  }

  /** Clear the DOM position override for a promoted view's interior widget. */
  private _clearDomOverrideForView(view: PromotedWidgetView): void {
    const resolved = resolveConcretePromotedWidget(
      this,
      view.sourceNodeId,
      view.sourceWidgetName
    )
    if (resolved.status !== 'resolved') return

    const interiorWidget = resolved.resolved.widget
    if (
      interiorWidget &&
      'id' in interiorWidget &&
      ('element' in interiorWidget || 'component' in interiorWidget)
    ) {
      useDomWidgetStore().clearPositionOverride(String(interiorWidget.id))
    }
  }

  private _removePromotedView(view: PromotedWidgetView): void {
    this._invalidatePromotedViewsCache()

    this._promotedViewManager.remove(view.sourceNodeId, view.sourceWidgetName)
    for (const input of this.inputs) {
      if (input._widget !== view || !input._subgraphSlot) continue
      const inputName = input.label ?? input.name

      this._promotedViewManager.removeByViewKey(
        view.sourceNodeId,
        view.sourceWidgetName,
        this._makePromotionViewKey(
          String(input._subgraphSlot.id),
          view.sourceNodeId,
          view.sourceWidgetName,
          inputName
        )
      )
    }
  }

  override removeWidget(widget: IBaseWidget): void {
    this.ensureWidgetRemoved(widget)
  }

  override ensureWidgetRemoved(widget: IBaseWidget): void {
    if (isPromotedWidgetView(widget)) {
      this._clearDomOverrideForView(widget)
      this._removePromotedView(widget)
    }
    for (const input of this.inputs) {
      if (input._widget === widget) {
        input._widget = undefined
        input.widget = undefined
      }
    }
    this.subgraph.events.dispatch('widget-demoted', {
      widget,
      subgraphNode: this
    })

    this._invalidatePromotedViewsCache()
  }

  override onRemoved(): void {
    this._eventAbortController.abort()
    this._invalidatePromotedViewsCache()

    for (const widget of this.widgets) {
      if (isPromotedWidgetView(widget)) {
        this._clearDomOverrideForView(widget)
      }
      this.subgraph.events.dispatch('widget-demoted', {
        widget,
        subgraphNode: this
      })
    }

    this._promotedViewManager.clear()

    for (const input of this.inputs) {
      if (
        input._listenerController &&
        typeof input._listenerController.abort === 'function'
      ) {
        input._listenerController.abort()
      }
    }
  }
  override drawTitleBox(
    ctx: CanvasRenderingContext2D,
    {
      scale,
      low_quality = false,
      title_height = LiteGraph.NODE_TITLE_HEIGHT,
      box_size = 10
    }: DrawTitleBoxOptions
  ): void {
    if (this.onDrawTitleBox) {
      this.onDrawTitleBox(ctx, title_height, this.renderingSize, scale)
      return
    }
    ctx.save()
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.roundRect(6, -24.5, 22, 20, 5)
    ctx.fill()
    if (!low_quality) {
      ctx.translate(25, 23)
      ctx.scale(-1.5, 1.5)
      ctx.drawImage(
        workflowBitmapCache.get(),
        0,
        -title_height,
        box_size,
        box_size
      )
    }
    ctx.restore()
  }

  /**
   * Serializes this SubgraphNode instance.
   *
   * After ADR 0009 the canonical owner of each promoted value widget is the
   * linked `SubgraphInput` itself; host-overlay values live in
   * `widgets_values`, and previews live in `properties.previewExposures`.
   * `properties.proxyWidgets` is no longer re-emitted; legacy data is preserved
   * for one-way ratchet load only.
   */
  override serialize(): ISerialisedNode {
    // TODO(adr-0009): Remove this comment once one stable release has shipped
    // without complaints about subgraph value drift. Host promoted-widget
    // values now serialize through standard SubgraphInput widgets and must not
    // be copied into interior widgets, which would cause cross-host stomping.

    const serialized = super.serialize()
    const serializedProperties = { ...(serialized.properties ?? {}) }
    const rootGraphId = this.rootGraph.id
    const hostLocator = String(this.id)

    const previewExposures = usePreviewExposureStore().getExposures(
      rootGraphId,
      hostLocator
    )
    if (previewExposures.length > 0) {
      serializedProperties.previewExposures = previewExposures.map((entry) => ({
        ...entry
      }))
    } else {
      delete serializedProperties.previewExposures
    }

    const quarantine = parseProxyWidgetErrorQuarantine(
      this.properties.proxyWidgetErrorQuarantine
    )
    if (quarantine.length === 0) {
      delete serializedProperties.proxyWidgetErrorQuarantine
    } else {
      serializedProperties.proxyWidgetErrorQuarantine = quarantine.map(
        (entry) => ({ ...entry })
      )
    }

    serialized.properties = serializedProperties

    const widgetStore = useWidgetValueStore()
    const widgetValues: TWidgetValue[] = []
    let hasSerializableValue = false

    for (const input of this.inputs) {
      const widget = input._widget
      if (!widget || !isPromotedWidgetView(widget)) continue
      const state = widgetStore.getWidget(
        rootGraphId,
        this.id,
        getPromotedWidgetHostStateName(widget)
      )
      const value =
        state && isWidgetValue(state.value) ? state.value : undefined
      widgetValues.push(value)
      hasSerializableValue ||= value !== undefined
    }

    if (hasSerializableValue) serialized.widgets_values = widgetValues
    else delete serialized.widgets_values

    return serialized
  }

  override clone() {
    const clone = super.clone()

    //TODO: Consider deep cloning subgraphs here.
    //It's the safest place to prevent creation of linked subgraphs
    //But the frequency of clone().serialize() calls is likely to result in
    //pollution of rootGraph.subgraphs

    return clone
  }
  getSlotShape(slot: SubgraphInput, extraInput?: INodeInputSlot) {
    const shapes = slot.linkIds.map(
      (id) => this.subgraph.links[id]?.resolve(this.subgraph)?.input?.shape
    )
    if (extraInput) shapes.push(extraInput.shape)
    return shapes.every((shape) => shape === shapes[0]) ? shapes[0] : undefined
  }
}
