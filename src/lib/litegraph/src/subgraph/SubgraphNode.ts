import cloneDeep from 'es-toolkit/compat/cloneDeep'
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
import type { INodeInputSlot, ISlotType } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
import { toNodeId } from '@/types/nodeId'
import type { SerializedNodeId } from '@/types/nodeId'
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
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import { parsePreviewExposures } from '@/core/schemas/previewExposureSchema'
import { parseProxyWidgetErrorQuarantine } from '@/core/schemas/proxyWidgetQuarantineSchema'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

import { ExecutableNodeDTO } from './ExecutableNodeDTO'
import type { ExecutableLGraphNode, ExecutionId } from './ExecutableNodeDTO'
import type { SubgraphInput } from './SubgraphInput'
import { createBitmapCache } from './svgBitmapCache'

const workflowSvg = new Image()
workflowSvg.src =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='16' height='16'%3E%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='white' stroke-linecap='round' stroke-width='1.3' d='M9.18613 3.09999H6.81377M9.18613 12.9H7.55288c-3.08678 0-5.35171-2.99581-4.60305-6.08843l.3054-1.26158M14.7486 2.1721l-.5931 2.45c-.132.54533-.6065.92789-1.1508.92789h-2.2993c-.77173 0-1.33797-.74895-1.1508-1.5221l.5931-2.45c.132-.54533.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.74896 1.1508 1.52211Zm-8.3033 0-.59309 2.45c-.13201.54533-.60646.92789-1.15076.92789H2.4021c-.7717 0-1.33793-.74895-1.15077-1.5221l.59309-2.45c.13201-.54533.60647-.9279 1.15077-.9279h2.29935c.77169 0 1.33792.74896 1.15076 1.52211Zm8.3033 9.8-.5931 2.45c-.132.5453-.6065.9279-1.1508.9279h-2.2993c-.77173 0-1.33797-.749-1.1508-1.5221l.5931-2.45c.132-.5453.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.7489 1.1508 1.5221Z'/%3E%3C/svg%3E %3C/svg%3E"

const workflowBitmapCache = createBitmapCache(workflowSvg, 32)

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

  get isDetached(): boolean {
    return !this.graph
  }

  override get displayType(): string {
    return 'Subgraph node'
  }

  override isSubgraphNode(): this is SubgraphNode {
    return true
  }

  declare widgets: IBaseWidget[]

  /**
   * Retained as a no-op for extension compatibility: promoted host widgets are
   * now store-backed and addressed by widgetId, so there is no view cache to
   * invalidate.
   */
  invalidatePromotedViews(): void {}

  private _eventAbortController = new AbortController()

  constructor(
    graph: GraphOrSubgraph,
    readonly subgraph: Subgraph,
    instanceData: ExportedSubgraphInstance
  ) {
    super(subgraph.name, subgraph.id)
    this.graph = graph

    Object.defineProperty(this, 'widgets', {
      get: () =>
        this.inputs.flatMap((input) => {
          const widget = this._projectPromotedWidget(input)
          return widget ? [widget] : []
        }),
      set: () => {
        if (import.meta.env.DEV)
          console.warn(
            'Cannot manually set widgets on SubgraphNode; use the promotion system.'
          )
      },
      configurable: true,
      enumerable: true
    })

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
          this._addSubgraphInputListeners(subgraphInput, existingInput)
          const linkId = subgraphInput.linkIds[0]
          if (linkId === undefined) return

          const link = this.subgraph.getLink(linkId)
          if (!link) return

          const { inputNode, input } = link.resolve(subgraph)
          if (!inputNode || !input) return

          const widget = inputNode.getWidgetFromSlot(input)
          if (widget)
            this._setWidget(subgraphInput, existingInput, widget, input.widget)
          return
        }
        const input = this.addInput(name, type, {
          _subgraphSlot: subgraphInput
        })
        this.invalidatePromotedViews()

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
        this.invalidatePromotedViews()
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
        if (input._widget) input._widget.label = newName
        if (input.widgetId) {
          const state = useWidgetValueStore().getWidget(input.widgetId)
          if (state) state.label = newName
        }
        this.invalidatePromotedViews()
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

  private _projectPromotedWidget(
    input: INodeInputSlot
  ): IBaseWidget | undefined {
    if (input._widget) return input._widget

    const id = input.widgetId
    if (!id) return

    const store = useWidgetValueStore()
    const widget: IBaseWidget = {
      get name() {
        return store.getWidget(id)?.name ?? input.name
      },
      get label() {
        return store.getWidget(id)?.label ?? input.label ?? input.name
      },
      set label(next) {
        const state = store.getWidget(id)
        if (state) state.label = next
      },
      get y() {
        return store.getWidget(id)?.y ?? 0
      },
      set y(next) {
        const state = store.getWidget(id)
        if (state) state.y = next
      },
      get type() {
        return store.getWidget(id)?.type ?? 'text'
      },
      get options() {
        return store.getWidget(id)?.options ?? {}
      },
      get value() {
        const value = store.getWidget(id)?.value
        return isWidgetValue(value) ? value : undefined
      },
      set value(next) {
        store.setValue(id, next)
      },
      // Canvas edits operate on a transient concrete widget (toConcreteWidget),
      // so the value setter above is never invoked; BaseWidget.setValue writes
      // its own local state and then calls this callback, which is the only
      // bridge back to the store.
      callback(next) {
        store.setValue(id, next)
      }
    }
    Object.defineProperty(widget, 'widgetId', {
      value: id,
      enumerable: false,
      configurable: true
    })
    input._widget = widget
    return input._widget
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
        input.shape = this.getSlotShape(subgraphInput, e.detail.input)
        if (!e.detail.widget || !e.detail.node) return

        this._setWidget(
          subgraphInput,
          input,
          e.detail.widget,
          e.detail.input.widget
        )
      },
      { signal }
    )

    subgraphInput.events.addEventListener(
      'input-disconnected',
      () => {
        this.invalidatePromotedViews()
        input.shape = this.getSlotShape(subgraphInput)

        const connectedWidgets = subgraphInput.getConnectedWidgets()
        if (connectedWidgets.length > 0) {
          this._resolveInputWidget(subgraphInput, input)
          this.invalidatePromotedViews()
          return
        }

        if (input._widget) this.ensureWidgetRemoved(input._widget)
        if (input.widgetId) useWidgetValueStore().deleteWidget(input.widgetId)

        delete input.pos
        delete input.widget
        delete input.widgetId
        input._widget = undefined
        this.invalidatePromotedViews()
      },
      { signal }
    )
  }

  private _rebindInputSubgraphSlots(): void {
    this.invalidatePromotedViews()

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
    this.invalidatePromotedViews()

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

  private _applyPromotedWidgetValues(
    widgetValues: ExportedSubgraphInstance['widgets_values']
  ): void {
    const quarantineValuesByInputName = this._readQuarantineHostValuesByName()

    let valueIndex = 0
    for (const input of this.inputs) {
      if (!input.widgetId) continue
      const value =
        quarantineValuesByInputName.get(input.name) ??
        widgetValues?.[valueIndex]
      if (value !== undefined) {
        useWidgetValueStore().setValue(input.widgetId, value)
      }
      valueIndex += 1
    }
  }

  private _readQuarantineHostValuesByName(): Map<string, TWidgetValue> {
    return new Map(
      parseProxyWidgetErrorQuarantine(
        this.properties.proxyWidgetErrorQuarantine
      )
        .toReversed()
        .flatMap(({ originalEntry: [sourceNodeId, name], hostValue }) =>
          sourceNodeId === '-1' &&
          hostValue !== undefined &&
          isWidgetValue(hostValue)
            ? [[name, hostValue] as const]
            : []
        )
    )
  }

  override _internalConfigureAfterSlots() {
    this._rebindInputSubgraphSlots()

    this.inputs = this.inputs.filter((input) => input._subgraphSlot)
    this.invalidatePromotedViews()

    this._hydratePreviewExposures()

    for (const input of this.inputs) {
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) {
        console.warn(
          `[SubgraphNode.configure] No subgraph input found for input ${input.name}, skipping`
        )
        continue
      }

      this._addSubgraphInputListeners(subgraphInput, input)
      this._resolveInputWidget(subgraphInput, input)
    }
  }

  private _hydratePreviewExposures() {
    const store = usePreviewExposureStore()
    const rootGraphId = this.rootGraph.id
    const hostLocator = String(this.id)
    const rawProperty = this.properties.previewExposures
    const hasExplicitProperty = Array.isArray(rawProperty)
    const fromProperty = parsePreviewExposures(rawProperty)
    if (fromProperty.length) {
      store.setExposures(rootGraphId, hostLocator, fromProperty)
      return
    }
    if (hasExplicitProperty) {
      store.setExposures(rootGraphId, hostLocator, [])
      return
    }
    const legacyKey = createNodeLocatorId(null, this.id)
    const legacy = store.getExposures(rootGraphId, legacyKey)
    if (legacy.length) {
      store.setExposures(rootGraphId, hostLocator, [...legacy])
      return
    }
    store.setExposures(rootGraphId, hostLocator, [])
  }

  rebuildInputWidgetBindings(): void {
    this.invalidatePromotedViews()

    for (const input of this.inputs) {
      delete input.widget
      delete input.pos
      delete input.widgetId
      this._clearPromotedWidget(input)
      const subgraphInput = input._subgraphSlot
      if (!subgraphInput) continue
      this._resolveInputWidget(subgraphInput, input)
    }

    this.invalidatePromotedViews()
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
      if (widget) {
        this._setWidget(subgraphInput, input, widget, targetInput.widget)
        break
      }

      // Nested promotion: the source is itself a promoted subgraph input with
      // no concrete widget. Resolve the deepest interior widget so this input
      // still receives widget state and a widgetId.
      const nested = this._resolveNestedPromotedSource(inputNode, targetInput)
      if (nested) {
        this._setWidget(subgraphInput, input, nested.widget, targetInput.widget)
        break
      }
    }
  }

  private _resolveNestedPromotedSource(
    inputNode: LGraphNode,
    targetInput: INodeInputSlot
  ): { node: LGraphNode; widget: IBaseWidget } | undefined {
    if (!inputNode.isSubgraphNode()) return undefined

    const target = resolveSubgraphInputTarget(inputNode, targetInput.name)
    if (!target) return undefined

    const resolved = resolveConcretePromotedWidget(
      inputNode,
      target.nodeId,
      target.widgetName
    )
    return resolved.status === 'resolved' ? resolved.resolved : undefined
  }

  private _setWidget(
    subgraphInput: Readonly<SubgraphInput>,
    input: INodeInputSlot,
    interiorWidget: Readonly<IBaseWidget>,
    inputWidget: IWidgetLocator | undefined
  ) {
    this.invalidatePromotedViews()

    this._clearPromotedWidget(input)

    input.widget ??= { name: subgraphInput.name }
    input.widget.name = subgraphInput.name
    if (inputWidget) Object.setPrototypeOf(input.widget, inputWidget)

    const id = widgetId(this.rootGraph.id, this.id, subgraphInput.name)
    input.widgetId = id
    useWidgetValueStore().registerWidget(id, {
      type: interiorWidget.type,
      value: interiorWidget.value,
      options: cloneDeep(interiorWidget.options ?? {}),
      label: input.label ?? subgraphInput.name,
      serialize: interiorWidget.serialize,
      disabled: interiorWidget.disabled,
      isDOMWidget:
        'isDOMWidget' in interiorWidget &&
        typeof interiorWidget.isDOMWidget === 'boolean'
          ? interiorWidget.isDOMWidget
          : undefined
    })
    input._widget =
      this.createPromotedHostWidget(input, id, interiorWidget) ??
      this._projectPromotedWidget(input)
    this._setConcreteSlots()

    this.subgraph.events.dispatch('widget-promoted', {
      widget: interiorWidget,
      subgraphNode: this
    })
  }

  /**
   * App-layer hook to build a promoted DOM widget; the default falls back to the
   * store-backed projection. Litegraph core stays free of Vue/Pinia/DOM.
   */
  protected createPromotedHostWidget(
    _input: INodeInputSlot,
    _id: WidgetId,
    _sourceWidget: Readonly<IBaseWidget>
  ): IBaseWidget | undefined {
    return undefined
  }

  /**
   * Runs the host widget's `onRemove` (unregistering DOM widgets) and clears it.
   * Unlike {@link ensureWidgetRemoved}, dispatches no demotion event, so it is
   * safe on re-resolution.
   */
  private _clearPromotedWidget(input: INodeInputSlot): void {
    input._widget?.onRemove?.()
    input._widget = undefined
  }

  override onAdded(_graph: LGraph): void {
    this.invalidatePromotedViews()
  }

  /**
   * @param name The name of the input slot.
   * @param type The type of the input slot.
   * @param inputProperties Properties that are directly assigned to the created input. Default: a new, empty object.
   * @returns The new input slot.
   */
  override addInput<TInput extends Partial<ISubgraphInput>>(
    name: string,
    type: ISlotType,
    inputProperties: TInput = {} as TInput
  ): INodeInputSlot & TInput {
    return super.addInput(name, type, inputProperties)
  }

  override getSlotFromWidget(
    widget: IBaseWidget | undefined
  ): INodeInputSlot | undefined {
    if (widget?.widgetId) {
      const promotedInput = this.inputs.find(
        (input) => input.widgetId === widget.widgetId
      )
      if (promotedInput) return promotedInput
    }
    return super.getSlotFromWidget(widget)
  }

  override getWidgetFromSlot(slot: INodeInputSlot): IBaseWidget | undefined {
    if (slot._widget) return slot._widget
    return super.getWidgetFromSlot(slot)
  }

  override getInputLink(slot: number): LLink | null {
    const innerLink = this.subgraph.outputNode.slots[slot].getLinks().at(0)
    if (!innerLink) {
      console.warn(
        `SubgraphNode.getInputLink: no inner link found for slot ${slot}`
      )
      return null
    }

    const newLink = LLink.create(innerLink)
    newLink.origin_id = toNodeId(`${this.id}:${innerLink.origin_id}`)
    newLink.origin_slot = innerLink.origin_slot

    return newLink
  }

  /**
   * @param slot The slot index
   * @returns The resolved connections, or undefined if no input node is found.
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

  override getInnerNodes(
    executableNodes: Map<ExecutionId, ExecutableLGraphNode>,
    subgraphNodePath: readonly SerializedNodeId[] = [],
    nodes: ExecutableLGraphNode[] = [],
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

    const parentSubgraphNode = this.rootGraph
      .resolveSubgraphIdPath(subgraphNodePath.map(toNodeId))
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

  override removeWidget(widget: IBaseWidget): void {
    this.ensureWidgetRemoved(widget)
  }

  override ensureWidgetRemoved(widget: IBaseWidget): void {
    widget.onRemove?.()
    this.subgraph.events.dispatch('widget-demoted', {
      widget,
      subgraphNode: this
    })
  }

  override onRemoved(): void {
    this._eventAbortController.abort()

    for (const input of this.inputs) {
      if (
        input._listenerController &&
        typeof input._listenerController.abort === 'function'
      ) {
        input._listenerController.abort()
      }
      this._clearPromotedWidget(input)
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

  override serialize(): ISerialisedNode {
    const serialized = super.serialize()
    const serializedProperties = { ...(serialized.properties ?? {}) }
    const rootGraphId = this.rootGraph.id
    const hostLocator = String(this.id)

    const previewExposures = usePreviewExposureStore().getExposures(
      rootGraphId,
      hostLocator
    )
    serializedProperties.previewExposures = previewExposures.map((entry) => ({
      ...entry
    }))

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

    const widgetValues = this.inputs.flatMap((input) => {
      if (!input.widgetId) return []
      const value = useWidgetValueStore().getWidget(input.widgetId)?.value
      return [isWidgetValue(value) ? value : undefined]
    })

    if (widgetValues.some((value) => value !== undefined)) {
      serialized.widgets_values = widgetValues
    } else {
      delete serialized.widgets_values
    }

    return serialized
  }

  override clone() {
    const clone = super.clone()

    // TODO: Consider deep cloning subgraphs here.

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
