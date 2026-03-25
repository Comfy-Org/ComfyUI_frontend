import type { BaseLGraph, LGraph } from '@/lib/litegraph/src/LGraph'
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
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import {
  createPromotedWidgetView,
  isPromotedWidgetView
} from '@/core/graph/subgraph/promotedWidgetView'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import { hasWidgetNode } from '@/core/graph/subgraph/widgetNodeTypeGuard'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  supportsVirtualCanvasImagePreview
} from '@/composables/node/canvasImagePreviewTypes'
import { parseProxyWidgets } from '@/core/schemas/promotionSchema'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import {
  makePromotionEntryKey,
  usePromotionStore
} from '@/stores/promotionStore'

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

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 */
export class SubgraphNode extends LGraphNode implements BaseLGraph {
  declare inputs: (INodeInputSlot & Partial<ISubgraphInput>)[]

  override readonly type: UUID
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
  /**
   * Promotions buffered before this node is attached to a graph (`id === -1`).
   * They are flushed in `_flushPendingPromotions()` from `_setWidget()` and
   * `onAdded()`, so construction-time promotions require normal add-to-graph
   * lifecycle to persist.
   */
  private _pendingPromotions: PromotedWidgetSource[] = []
  private _cacheVersion = 0
  private _linkedEntriesCache?: {
    version: number
    hasMissingBoundSourceWidget: boolean
    entries: LinkedPromotionEntry[]
  }
  private _promotedViewsCache?: {
    version: number
    entriesRef: PromotedWidgetSource[]
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
        if (isPromotedWidgetView(targetWidget)) {
          return {
            sourceNodeId: String(inputNode.id),
            sourceWidgetName: targetWidget.sourceWidgetName,
            disambiguatingSourceNodeId:
              targetWidget.disambiguatingSourceNodeId ??
              targetWidget.sourceNodeId
          }
        }
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
    const cached = this._linkedEntriesCache
    if (
      cache &&
      cached?.version === this._cacheVersion &&
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
        entry.inputName,
        entry.disambiguatingSourceNodeId
      )
      if (seenEntryKeys.has(entryKey)) return false

      seenEntryKeys.add(entryKey)
      return true
    })

    if (cache)
      this._linkedEntriesCache = {
        version: this._cacheVersion,
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
    const store = usePromotionStore()
    const entries = store.getPromotionsRef(this.rootGraph.id, this.id)
    const hasMissingBoundSourceWidget = this._hasMissingBoundSourceWidget()
    const cachedViews = this._promotedViewsCache
    if (
      cachedViews?.version === this._cacheVersion &&
      cachedViews.entriesRef === entries &&
      cachedViews.hasMissingBoundSourceWidget === hasMissingBoundSourceWidget
    )
      return cachedViews.views

    const linkedEntries = this._getLinkedPromotionEntries()

    const { displayNameByViewKey, reconcileEntries } =
      this._buildPromotionReconcileState(entries, linkedEntries)

    const views = this._promotedViewManager.reconcile(
      reconcileEntries,
      (entry) =>
        createPromotedWidgetView(
          this,
          entry.sourceNodeId,
          entry.sourceWidgetName,
          entry.viewKey ? displayNameByViewKey.get(entry.viewKey) : undefined,
          entry.disambiguatingSourceNodeId,
          entry.slotName
        )
    )

    this._promotedViewsCache = {
      version: this._cacheVersion,
      entriesRef: entries,
      hasMissingBoundSourceWidget,
      views
    }

    return views
  }

  private _invalidatePromotedViewsCache(): void {
    this._cacheVersion++
  }

  private _syncPromotions(): void {
    if (this.id === -1) return

    const store = usePromotionStore()
    const entries = store.getPromotionsRef(this.rootGraph.id, this.id)
    const linkedEntries = this._getLinkedPromotionEntries(false)
    // Intentionally preserve independent store promotions when linked coverage is partial;
    // tests assert that mixed linked/independent states must not collapse to linked-only.
    const { mergedEntries } = this._buildPromotionPersistenceState(
      entries,
      linkedEntries
    )

    const hasChanged =
      mergedEntries.length !== entries.length ||
      mergedEntries.some(
        (entry, index) =>
          entry.sourceNodeId !== entries[index]?.sourceNodeId ||
          entry.sourceWidgetName !== entries[index]?.sourceWidgetName ||
          entry.disambiguatingSourceNodeId !==
            entries[index]?.disambiguatingSourceNodeId
      )

    if (!hasChanged) return

    store.setPromotions(this.rootGraph.id, this.id, mergedEntries)
  }

  private _buildPromotionReconcileState(
    entries: PromotedWidgetSource[],
    linkedEntries: LinkedPromotionEntry[]
  ): {
    displayNameByViewKey: Map<string, string>
    reconcileEntries: Array<{
      sourceNodeId: string
      sourceWidgetName: string
      viewKey?: string
      disambiguatingSourceNodeId?: string
      slotName?: string
    }>
  } {
    const { fallbackStoredEntries } = this._collectLinkedAndFallbackEntries(
      entries,
      linkedEntries
    )
    const linkedReconcileEntries =
      this._buildLinkedReconcileEntries(linkedEntries)
    const shouldPersistLinkedOnly = this._shouldPersistLinkedOnly(
      linkedEntries,
      fallbackStoredEntries
    )
    const fallbackReconcileEntries = fallbackStoredEntries.map((e) =>
      e.disambiguatingSourceNodeId
        ? {
            sourceNodeId: e.sourceNodeId,
            sourceWidgetName: e.sourceWidgetName,
            disambiguatingSourceNodeId: e.disambiguatingSourceNodeId,
            viewKey: `src:${e.sourceNodeId}:${e.sourceWidgetName}:${e.disambiguatingSourceNodeId}`
          }
        : e
    )
    const reconcileEntries = shouldPersistLinkedOnly
      ? linkedReconcileEntries
      : [...linkedReconcileEntries, ...fallbackReconcileEntries]

    return {
      displayNameByViewKey: this._buildDisplayNameByViewKey(linkedEntries),
      reconcileEntries
    }
  }

  private _buildPromotionPersistenceState(
    entries: PromotedWidgetSource[],
    linkedEntries: LinkedPromotionEntry[]
  ): {
    mergedEntries: PromotedWidgetSource[]
  } {
    const { linkedPromotionEntries, fallbackStoredEntries } =
      this._collectLinkedAndFallbackEntries(entries, linkedEntries)
    const shouldPersistLinkedOnly = this._shouldPersistLinkedOnly(
      linkedEntries,
      fallbackStoredEntries
    )

    return {
      mergedEntries: shouldPersistLinkedOnly
        ? linkedPromotionEntries
        : [...linkedPromotionEntries, ...fallbackStoredEntries]
    }
  }

  private _collectLinkedAndFallbackEntries(
    entries: PromotedWidgetSource[],
    linkedEntries: LinkedPromotionEntry[]
  ): {
    linkedPromotionEntries: PromotedWidgetSource[]
    fallbackStoredEntries: PromotedWidgetSource[]
  } {
    const linkedPromotionEntries = this._toPromotionEntries(linkedEntries)
    const excludedEntryKeys = new Set(
      linkedPromotionEntries.map((entry) =>
        this._makePromotionEntryKey(
          entry.sourceNodeId,
          entry.sourceWidgetName,
          entry.disambiguatingSourceNodeId
        )
      )
    )
    const connectedEntryKeys = this._getConnectedPromotionEntryKeys()
    for (const key of connectedEntryKeys) {
      excludedEntryKeys.add(key)
    }

    const prePruneFallbackStoredEntries = this._getFallbackStoredEntries(
      entries,
      excludedEntryKeys
    )
    const fallbackStoredEntries = this._pruneStaleAliasFallbackEntries(
      prePruneFallbackStoredEntries,
      linkedPromotionEntries
    )

    return {
      linkedPromotionEntries,
      fallbackStoredEntries
    }
  }

  private _shouldPersistLinkedOnly(
    linkedEntries: LinkedPromotionEntry[],
    fallbackStoredEntries: PromotedWidgetSource[]
  ): boolean {
    if (
      !(this.inputs.length > 0 && linkedEntries.length === this.inputs.length)
    )
      return false

    const linkedEntryKeys = new Set(
      linkedEntries.map((entry) =>
        this._makePromotionEntryKey(entry.sourceNodeId, entry.sourceWidgetName)
      )
    )

    const linkedWidgetNames = new Set(
      linkedEntries.map((entry) => entry.sourceWidgetName)
    )

    const hasFallbackToKeep = fallbackStoredEntries.some((entry) => {
      const sourceNode = this.subgraph.getNodeById(entry.sourceNodeId)
      if (!sourceNode) return linkedWidgetNames.has(entry.sourceWidgetName)

      const hasSourceWidget =
        sourceNode.widgets?.some(
          (widget) => widget.name === entry.sourceWidgetName
        ) === true
      if (hasSourceWidget) return true

      // If the fallback entry overlaps a linked entry, keep it
      // until aliasing can be positively proven.
      return linkedEntryKeys.has(
        this._makePromotionEntryKey(entry.sourceNodeId, entry.sourceWidgetName)
      )
    })

    return !hasFallbackToKeep
  }

  private _toPromotionEntries(
    linkedEntries: LinkedPromotionEntry[]
  ): PromotedWidgetSource[] {
    return linkedEntries.map(
      ({ sourceNodeId, sourceWidgetName, disambiguatingSourceNodeId }) => ({
        sourceNodeId,
        sourceWidgetName,
        ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
      })
    )
  }

  private _getFallbackStoredEntries(
    entries: PromotedWidgetSource[],
    excludedEntryKeys: Set<string>
  ): PromotedWidgetSource[] {
    return entries.filter(
      (entry) =>
        !excludedEntryKeys.has(
          this._makePromotionEntryKey(
            entry.sourceNodeId,
            entry.sourceWidgetName,
            entry.disambiguatingSourceNodeId
          )
        )
    )
  }

  private _pruneStaleAliasFallbackEntries(
    fallbackStoredEntries: PromotedWidgetSource[],
    linkedPromotionEntries: PromotedWidgetSource[]
  ): PromotedWidgetSource[] {
    if (
      fallbackStoredEntries.length === 0 ||
      linkedPromotionEntries.length === 0
    )
      return fallbackStoredEntries

    const linkedConcreteKeys = new Set(
      linkedPromotionEntries
        .map((entry) => this._resolveConcretePromotionEntryKey(entry))
        .filter((key): key is string => key !== undefined)
    )
    if (linkedConcreteKeys.size === 0) return fallbackStoredEntries

    const prunedEntries: PromotedWidgetSource[] = []

    for (const entry of fallbackStoredEntries) {
      if (!this.subgraph.getNodeById(entry.sourceNodeId)) continue

      const concreteKey = this._resolveConcretePromotionEntryKey(entry)
      if (concreteKey && linkedConcreteKeys.has(concreteKey)) continue

      prunedEntries.push(entry)
    }

    return prunedEntries
  }

  private _resolveConcretePromotionEntryKey(
    entry: PromotedWidgetSource
  ): string | undefined {
    const result = resolveConcretePromotedWidget(
      this,
      entry.sourceNodeId,
      entry.sourceWidgetName,
      entry.disambiguatingSourceNodeId
    )
    if (result.status !== 'resolved') return undefined

    return this._makePromotionEntryKey(
      String(result.resolved.node.id),
      result.resolved.widget.name
    )
  }

  private _getConnectedPromotionEntryKeys(): Set<string> {
    const connectedEntryKeys = new Set<string>()

    for (const input of this.inputs) {
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) continue

      const connectedWidgets = subgraphInput.getConnectedWidgets()

      for (const widget of connectedWidgets) {
        if (!hasWidgetNode(widget)) continue

        connectedEntryKeys.add(
          this._makePromotionEntryKey(String(widget.node.id), widget.name)
        )
      }
    }

    return connectedEntryKeys
  }

  private _buildLinkedReconcileEntries(
    linkedEntries: LinkedPromotionEntry[]
  ): Array<{
    sourceNodeId: string
    sourceWidgetName: string
    viewKey: string
    disambiguatingSourceNodeId?: string
    slotName: string
  }> {
    return linkedEntries.map(
      ({
        inputKey,
        inputName,
        slotName,
        sourceNodeId,
        sourceWidgetName,
        disambiguatingSourceNodeId
      }) => ({
        sourceNodeId,
        sourceWidgetName,
        slotName,
        disambiguatingSourceNodeId,
        viewKey: this._makePromotionViewKey(
          inputKey,
          sourceNodeId,
          sourceWidgetName,
          inputName,
          disambiguatingSourceNodeId
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
          entry.inputName,
          entry.disambiguatingSourceNodeId
        ),
        entry.inputName
      ])
    )
  }

  private _makePromotionEntryKey(
    sourceNodeId: string,
    sourceWidgetName: string,
    disambiguatingSourceNodeId?: string
  ): string {
    return makePromotionEntryKey({
      sourceNodeId,
      sourceWidgetName,
      disambiguatingSourceNodeId
    })
  }

  private _makePromotionViewKey(
    inputKey: string,
    sourceNodeId: string,
    sourceWidgetName: string,
    inputName = '',
    disambiguatingSourceNodeId?: string
  ): string {
    return disambiguatingSourceNodeId
      ? JSON.stringify([
          inputKey,
          sourceNodeId,
          sourceWidgetName,
          inputName,
          disambiguatingSourceNodeId
        ])
      : JSON.stringify([inputKey, sourceNodeId, sourceWidgetName, inputName])
  }

  private _serializeEntries(
    entries: PromotedWidgetSource[]
  ): (string[] | [string, string, string])[] {
    return entries.map((e) =>
      e.disambiguatingSourceNodeId
        ? [e.sourceNodeId, e.sourceWidgetName, e.disambiguatingSourceNodeId]
        : [e.sourceNodeId, e.sourceWidgetName]
    )
  }

  private _resolveLegacyEntry(
    widgetName: string
  ): [string, string] | undefined {
    // Legacy -1 entries use the slot name as the widget name.
    // Find the input with that name, then trace to the connected interior widget.
    const input = this.inputs.find((i) => i.name === widgetName)
    if (!input?._widget) {
      // Fallback: find via subgraph input slot connection
      const resolvedTarget = resolveSubgraphInputTarget(this, widgetName)
      if (!resolvedTarget) return undefined
      return [resolvedTarget.nodeId, resolvedTarget.widgetName]
    }

    const widget = input._widget
    if (isPromotedWidgetView(widget)) {
      return [widget.sourceNodeId, widget.sourceWidgetName]
    }

    // Fallback: find via subgraph input slot connection
    const resolvedTarget = resolveSubgraphInputTarget(this, widgetName)
    if (!resolvedTarget) return undefined

    return [resolvedTarget.nodeId, resolvedTarget.widgetName]
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
        this._syncPromotions()
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
        const nodeId = String(e.detail.node.id)
        const source: PromotedWidgetSource = {
          sourceNodeId: nodeId,
          sourceWidgetName: e.detail.widget.name
        }
        if (
          usePromotionStore().isPromoted(this.rootGraph.id, this.id, source)
        ) {
          usePromotionStore().demote(this.rootGraph.id, this.id, source)
        }

        const didSetWidgetFromEvent = !input._widget
        if (didSetWidgetFromEvent)
          this._setWidget(
            subgraphInput,
            input,
            e.detail.widget,
            e.detail.input.widget,
            e.detail.node
          )

        this._syncPromotions()
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
          this._syncPromotions()
          return
        }

        if (input._widget) this.ensureWidgetRemoved(input._widget)

        delete input.pos
        delete input.widget
        input._widget = undefined
        this._syncPromotions()
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
  }

  override _internalConfigureAfterSlots() {
    this._rebindInputSubgraphSlots()

    // Prune inputs that don't map to any subgraph slot definition.
    // This prevents stale/duplicate serialized inputs from persisting (#9977).
    this.inputs = this.inputs.filter((input) => input._subgraphSlot)

    // Ensure proxyWidgets is initialized so it serializes
    this.properties.proxyWidgets ??= []

    // Clear view cache — forces re-creation on next getter access.
    // Do NOT clear properties.proxyWidgets — it was already populated
    // from serialized data by super.configure(info) before this runs.
    this._promotedViewManager.clear()
    this._invalidatePromotedViewsCache()

    // Hydrate the store from serialized properties.proxyWidgets
    const raw = parseProxyWidgets(this.properties.proxyWidgets)
    const store = usePromotionStore()

    const entries = raw
      .map(([nodeId, widgetName, sourceNodeId]) => {
        if (nodeId === '-1') {
          const resolved = this._resolveLegacyEntry(widgetName)
          if (resolved)
            return { sourceNodeId: resolved[0], sourceWidgetName: resolved[1] }
          if (import.meta.env.DEV) {
            console.warn(
              `[SubgraphNode] Failed to resolve legacy -1 entry for widget "${widgetName}"`
            )
          }
          return null
        }
        if (!this.subgraph.getNodeById(nodeId)) return null
        const entry: PromotedWidgetSource = {
          sourceNodeId: nodeId,
          sourceWidgetName: widgetName,
          ...(sourceNodeId && { disambiguatingSourceNodeId: sourceNodeId })
        }
        return entry
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    store.setPromotions(this.rootGraph.id, this.id, entries)

    // Write back resolved entries so legacy or stale entries don't persist
    if (entries.length !== raw.length) {
      this.properties.proxyWidgets = this._serializeEntries(entries)
    }

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

    this._syncPromotions()

    for (const node of this.subgraph.nodes) {
      if (!supportsVirtualCanvasImagePreview(node)) continue
      const source: PromotedWidgetSource = {
        sourceNodeId: String(node.id),
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
      if (store.isPromoted(this.rootGraph.id, this.id, source)) continue
      store.promote(this.rootGraph.id, this.id, source)
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
      input._widget = undefined
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) continue
      this._resolveInputWidget(subgraphInput, input)
    }

    this._syncPromotions()
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
    this._flushPendingPromotions()

    const nodeId = String(interiorNode.id)
    const widgetName = interiorWidget.name
    const sourceNodeId =
      interiorNode.isSubgraphNode() && isPromotedWidgetView(interiorWidget)
        ? interiorWidget.sourceNodeId
        : undefined

    const previousView = input._widget

    if (
      previousView &&
      isPromotedWidgetView(previousView) &&
      (previousView.sourceNodeId !== nodeId ||
        previousView.sourceWidgetName !== widgetName)
    ) {
      usePromotionStore().demote(this.rootGraph.id, this.id, previousView)
      this._removePromotedView(previousView)
    }

    if (this.id === -1) {
      if (
        !this._pendingPromotions.some(
          (entry) =>
            entry.sourceNodeId === nodeId &&
            entry.sourceWidgetName === widgetName &&
            entry.disambiguatingSourceNodeId === sourceNodeId
        )
      ) {
        this._pendingPromotions.push({
          sourceNodeId: nodeId,
          sourceWidgetName: widgetName,
          ...(sourceNodeId && { disambiguatingSourceNodeId: sourceNodeId })
        })
      }
    } else {
      // Add to promotion store
      usePromotionStore().promote(this.rootGraph.id, this.id, {
        sourceNodeId: nodeId,
        sourceWidgetName: widgetName,
        disambiguatingSourceNodeId: sourceNodeId
      })
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
          sourceNodeId,
          subgraphInput.name
        ),
      this._makePromotionViewKey(
        String(subgraphInput.id),
        nodeId,
        widgetName,
        input.label ?? input.name,
        sourceNodeId
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

  private _flushPendingPromotions() {
    if (this.id === -1 || this._pendingPromotions.length === 0) return

    for (const entry of this._pendingPromotions) {
      usePromotionStore().promote(this.rootGraph.id, this.id, entry)
    }

    this._pendingPromotions = []
  }

  override onAdded(_graph: LGraph): void {
    this._flushPendingPromotions()
    this._syncPromotions()
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
      view.sourceWidgetName,
      view.disambiguatingSourceNodeId
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
          inputName,
          view.disambiguatingSourceNodeId
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
      usePromotionStore().demote(this.rootGraph.id, this.id, widget)
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

    this._syncPromotions()
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

    usePromotionStore().setPromotions(this.rootGraph.id, this.id, [])
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
   * Synchronizes widget values from this SubgraphNode instance to the
   * corresponding widgets in the subgraph definition before serialization.
   * This ensures nested subgraph widget values are preserved when saving.
   */
  override serialize(): ISerialisedNode {
    // Sync widget values to subgraph definition before serialization.
    // Only sync for inputs that are linked to a promoted widget via _widget.
    for (const input of this.inputs) {
      if (!input._widget) continue

      const subgraphInput =
        input._subgraphSlot ??
        this.subgraph.inputNode.slots.find((slot) => slot.name === input.name)
      if (!subgraphInput) continue

      const connectedWidgets = subgraphInput.getConnectedWidgets()
      for (const connectedWidget of connectedWidgets) {
        connectedWidget.value = input._widget.value
      }
    }

    // Write promotion store state back to properties for serialization
    const entries = usePromotionStore().getPromotions(
      this.rootGraph.id,
      this.id
    )
    this.properties.proxyWidgets = this._serializeEntries(entries)

    return super.serialize()
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
