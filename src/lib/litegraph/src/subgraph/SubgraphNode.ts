import type { BaseLGraph, LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphButton } from '@/lib/litegraph/src/LGraphButton'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { DrawTitleBoxOptions } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { ResolvedConnection } from '@/lib/litegraph/src/LLink'
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
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'

import { ExecutableNodeDTO } from './ExecutableNodeDTO'
import type { ExecutableLGraphNode, ExecutionId } from './ExecutableNodeDTO'
import type { SubgraphInput } from './SubgraphInput'

const workflowSvg = new Image()
workflowSvg.src =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='16' height='16'%3E%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='white' stroke-linecap='round' stroke-width='1.3' d='M9.18613 3.09999H6.81377M9.18613 12.9H7.55288c-3.08678 0-5.35171-2.99581-4.60305-6.08843l.3054-1.26158M14.7486 2.1721l-.5931 2.45c-.132.54533-.6065.92789-1.1508.92789h-2.2993c-.77173 0-1.33797-.74895-1.1508-1.5221l.5931-2.45c.132-.54533.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.74896 1.1508 1.52211Zm-8.3033 0-.59309 2.45c-.13201.54533-.60646.92789-1.15076.92789H2.4021c-.7717 0-1.33793-.74895-1.15077-1.5221l.59309-2.45c.13201-.54533.60647-.9279 1.15077-.9279h2.29935c.77169 0 1.33792.74896 1.15076 1.52211Zm8.3033 9.8-.5931 2.45c-.132.5453-.6065.9279-1.1508.9279h-2.2993c-.77173 0-1.33797-.749-1.1508-1.5221l.5931-2.45c.132-.5453.6065-.9279 1.1508-.9279h2.2993c.7717 0 1.3379.7489 1.1508 1.5221Z'/%3E%3C/svg%3E %3C/svg%3E"

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 */
export class SubgraphNode extends LGraphNode implements BaseLGraph {
  declare inputs: (INodeInputSlot & Partial<ISubgraphInput>)[]

  override readonly type: UUID
  override readonly isVirtualNode = true as const

  get rootGraph(): LGraph {
    return this.graph.rootGraph
  }

  override get displayType(): string {
    return 'Subgraph node'
  }

  override isSubgraphNode(): this is SubgraphNode {
    return true
  }

  override widgets: IBaseWidget[] = []

  /** Manages lifecycle of all subgraph event listeners */
  #eventAbortController = new AbortController()

  constructor(
    /** The (sub)graph that contains this subgraph instance. */
    override readonly graph: GraphOrSubgraph,
    /** The definition of this subgraph; how its nodes are configured, etc. */
    readonly subgraph: Subgraph,
    instanceData: ExportedSubgraphInstance
  ) {
    super(subgraph.name, subgraph.id)

    // Update this node when the subgraph input / output slots are changed
    const subgraphEvents = this.subgraph.events
    const { signal } = this.#eventAbortController

    subgraphEvents.addEventListener(
      'input-added',
      (e) => {
        const subgraphInput = e.detail.input
        const { name, type } = subgraphInput
        const existingInput = this.inputs.find((i) => i.name == name)
        if (existingInput) {
          const linkId = subgraphInput.linkIds[0]
          const { inputNode, input } = subgraph.links[linkId].resolve(subgraph)
          const widget = inputNode?.widgets?.find?.((w) => w.name == name)
          if (widget)
            this.#setWidget(subgraphInput, existingInput, widget, input?.widget)
          return
        }
        const input = this.addInput(name, type)

        this.#addSubgraphInputListeners(subgraphInput, input)
      },
      { signal }
    )

    subgraphEvents.addEventListener(
      'removing-input',
      (e) => {
        const widget = e.detail.input._widget
        if (widget) this.ensureWidgetRemoved(widget)

        this.removeInput(e.detail.index)
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
        if (input._widget) {
          input._widget.label = newName
        }
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

  #addSubgraphInputListeners(
    subgraphInput: SubgraphInput,
    input: INodeInputSlot & Partial<ISubgraphInput>
  ) {
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
        if (input._widget) return

        const widget = subgraphInput._widget
        if (!widget) return

        const widgetLocator = e.detail.input.widget
        this.#setWidget(subgraphInput, input, widget, widgetLocator)
      },
      { signal }
    )

    subgraphInput.events.addEventListener(
      'input-disconnected',
      () => {
        // If the input is connected to more than one widget, don't remove the widget
        const connectedWidgets = subgraphInput.getConnectedWidgets()
        if (connectedWidgets.length > 0) return

        this.removeWidgetByName(input.name)

        delete input.pos
        delete input.widget
        input._widget = undefined
      },
      { signal }
    )
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
      ...this.subgraph.inputNode.slots.map(
        (slot) =>
          new NodeInputSlot(
            {
              name: slot.name,
              localized_name: slot.localized_name,
              label: slot.label,
              type: slot.type,
              link: null
            },
            this
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
    // Reset widgets
    this.widgets.length = 0

    // Check all inputs for connected widgets
    for (const input of this.inputs) {
      const subgraphInput = this.subgraph.inputNode.slots.find(
        (slot) => slot.name === input.name
      )
      if (!subgraphInput) {
        // Skip inputs that don't exist in the subgraph definition
        // This can happen when loading workflows with dynamically added inputs
        console.warn(
          `[SubgraphNode.configure] No subgraph input found for input ${input.name}, skipping`
        )
        continue
      }

      this.#addSubgraphInputListeners(subgraphInput, input)

      // Find the first widget that this slot is connected to
      for (const linkId of subgraphInput.linkIds) {
        const link = this.subgraph.getLink(linkId)
        if (!link) {
          console.warn(
            `[SubgraphNode.configure] No link found for link ID ${linkId}`,
            this
          )
          continue
        }

        const resolved = link.resolve(this.subgraph)
        if (!resolved.input || !resolved.inputNode) {
          console.warn('Invalid resolved link', resolved, this)
          continue
        }

        // No widget - ignore this link
        const widget = resolved.inputNode.getWidgetFromSlot(resolved.input)
        if (!widget) continue

        this.#setWidget(subgraphInput, input, widget, resolved.input.widget)
        break
      }
    }
  }

  #setWidget(
    subgraphInput: Readonly<SubgraphInput>,
    input: INodeInputSlot,
    widget: Readonly<IBaseWidget>,
    inputWidget: IWidgetLocator | undefined
  ) {
    // Use the first matching widget
    const promotedWidget = toConcreteWidget(widget, this).createCopyForNode(
      this
    )

    Object.assign(promotedWidget, {
      get name() {
        return subgraphInput.name
      },
      set name(value) {
        console.warn(
          'Promoted widget: setting name is not allowed',
          this,
          value
        )
      },
      get localized_name() {
        return subgraphInput.localized_name
      },
      set localized_name(value) {
        console.warn(
          'Promoted widget: setting localized_name is not allowed',
          this,
          value
        )
      },
      get label() {
        return subgraphInput.label
      },
      set label(value) {
        console.warn(
          'Promoted widget: setting label is not allowed',
          this,
          value
        )
      },
      get tooltip() {
        // Preserve the original widget's tooltip for promoted widgets
        return widget.tooltip
      },
      set tooltip(value) {
        console.warn(
          'Promoted widget: setting tooltip is not allowed',
          this,
          value
        )
      }
    })

    const widgetCount = this.inputs.filter((i) => i.widget).length
    this.widgets.splice(widgetCount, 0, promotedWidget)

    // Dispatch widget-promoted event
    this.subgraph.events.dispatch('widget-promoted', {
      widget: promotedWidget,
      subgraphNode: this
    })

    // NOTE: This code creates linked chains of prototypes for passing across
    // multiple levels of subgraphs. As part of this, it intentionally avoids
    // creating new objects. Have care when making changes.
    input.widget ??= { name: subgraphInput.name }
    input.widget.name = subgraphInput.name
    if (inputWidget) Object.setPrototypeOf(input.widget, inputWidget)

    input._widget = promotedWidget
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
    const parentSubgraphNode = this.graph.rootGraph
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

  override removeWidgetByName(name: string): void {
    const widget = this.widgets.find((w) => w.name === name)
    if (widget) {
      this.subgraph.events.dispatch('widget-demoted', {
        widget,
        subgraphNode: this
      })
    }
    super.removeWidgetByName(name)
  }

  override ensureWidgetRemoved(widget: IBaseWidget): void {
    if (this.widgets.includes(widget)) {
      this.subgraph.events.dispatch('widget-demoted', {
        widget,
        subgraphNode: this
      })
    }
    super.ensureWidgetRemoved(widget)
  }

  override onRemoved(): void {
    // Clean up all subgraph event listeners
    this.#eventAbortController.abort()

    // Clean up all promoted widgets
    for (const widget of this.widgets) {
      if ('isProxyWidget' in widget && widget.isProxyWidget) continue
      this.subgraph.events.dispatch('widget-demoted', {
        widget,
        subgraphNode: this
      })
    }

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
      ctx.drawImage(workflowSvg, 0, -title_height, box_size, box_size)
    }
    ctx.restore()
  }

  /**
   * Synchronizes widget values from this SubgraphNode instance to the
   * corresponding widgets in the subgraph definition before serialization.
   * This ensures nested subgraph widget values are preserved when saving.
   */
  override serialize(): ISerialisedNode {
    // Sync widget values to subgraph definition before serialization
    for (let i = 0; i < this.widgets.length; i++) {
      const widget = this.widgets[i]
      const input = this.inputs.find((inp) => inp.name === widget.name)

      if (input) {
        const subgraphInput = this.subgraph.inputNode.slots.find(
          (slot) => slot.name === input.name
        )

        if (subgraphInput) {
          // Find all widgets connected to this subgraph input
          const connectedWidgets = subgraphInput.getConnectedWidgets()

          // Update the value of all connected widgets
          for (const connectedWidget of connectedWidgets) {
            connectedWidget.value = widget.value
          }
        }
      }
    }

    // Call parent serialize method
    return super.serialize()
  }
  override clone() {
    const clone = super.clone()
    // force reasign so domWidgets reset ownership
    // eslint-disable-next-line  no-self-assign
    this.properties.proxyWidgets = this.properties.proxyWidgets

    //TODO: Consider deep cloning subgraphs here.
    //It's the safest place to prevent creation of linked subgraphs
    //But the frequency of clone().serialize() calls is likely to result in
    //pollution of rootGraph.subgraphs

    return clone
  }
}
