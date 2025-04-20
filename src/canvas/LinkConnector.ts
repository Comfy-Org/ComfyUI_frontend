import type { RenderLink } from "./RenderLink"
import type { ConnectingLink, ItemLocator, LinkNetwork, LinkSegment } from "@/interfaces"
import type { INodeInputSlot, INodeOutputSlot } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { Reroute } from "@/Reroute"
import type { CanvasPointerEvent } from "@/types/events"
import type { IWidget } from "@/types/widgets"

import { LinkConnectorEventMap, LinkConnectorEventTarget } from "@/infrastructure/LinkConnectorEventTarget"
import { LLink } from "@/LLink"
import { LinkDirection } from "@/types/globalEnums"

import { FloatingRenderLink } from "./FloatingRenderLink"
import { MovingInputLink } from "./MovingInputLink"
import { MovingLinkBase } from "./MovingLinkBase"
import { MovingOutputLink } from "./MovingOutputLink"
import { ToInputRenderLink } from "./ToInputRenderLink"
import { ToOutputRenderLink } from "./ToOutputRenderLink"

/**
 * A Litegraph state object for the {@link LinkConnector}.
 * References are only held atomically within a function, never passed.
 * The concrete implementation may be replaced or proxied without side-effects.
 */
export interface LinkConnectorState {
  /**
   * The type of slot that links are being connected **to**.
   * - When `undefined`, no operation is being performed.
   * - A change in this property indicates the start or end of dragging links.
   */
  connectingTo: "input" | "output" | undefined
  multi: boolean
  /** When `true`, existing links are being repositioned. Otherwise, new links are being created. */
  draggingExistingLinks: boolean
}

/** Discriminated union to simplify type narrowing. */
type RenderLinkUnion = MovingInputLink | MovingOutputLink | FloatingRenderLink | ToInputRenderLink | ToOutputRenderLink

export interface LinkConnectorExport {
  renderLinks: RenderLink[]
  inputLinks: LLink[]
  outputLinks: LLink[]
  floatingLinks: LLink[]
  state: LinkConnectorState
  network: LinkNetwork
}

/**
 * Component of {@link LGraphCanvas} that handles connecting and moving links.
 * @see {@link LLink}
 */
export class LinkConnector {
  /**
   * Link connection state POJO. Source of truth for state of link drag operations.
   *
   * Can be replaced or proxied to allow notifications.
   * Is always dereferenced at the start of an operation.
   */
  state: LinkConnectorState = {
    connectingTo: undefined,
    multi: false,
    draggingExistingLinks: false,
  }

  readonly events = new LinkConnectorEventTarget()

  /** Contains information for rendering purposes only. */
  readonly renderLinks: RenderLinkUnion[] = []

  /** Existing links that are being moved **to** a new input slot. */
  readonly inputLinks: LLink[] = []
  /** Existing links that are being moved **to** a new output slot. */
  readonly outputLinks: LLink[] = []
  /** Existing floating links that are being moved to a new slot. */
  readonly floatingLinks: LLink[] = []

  readonly hiddenReroutes: Set<Reroute> = new Set()

  /** The widget beneath the pointer, if it is a valid connection target. */
  overWidget?: IWidget
  /** The type (returned by downstream callback) for {@link overWidget} */
  overWidgetType?: string

  /** The reroute beneath the pointer, if it is a valid connection target. */
  overReroute?: Reroute

  readonly #setConnectingLinks: (value: ConnectingLink[]) => void

  constructor(setConnectingLinks: (value: ConnectingLink[]) => void) {
    this.#setConnectingLinks = setConnectingLinks
  }

  get isConnecting() {
    return this.state.connectingTo !== undefined
  }

  get draggingExistingLinks() {
    return this.state.draggingExistingLinks
  }

  /** Drag an existing link to a different input. */
  moveInputLink(network: LinkNetwork, input: INodeInputSlot): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const { state, inputLinks, renderLinks } = this

    const linkId = input.link
    if (linkId == null) {
      // No link connected, check for a floating link
      const floatingLink = input._floatingLinks?.values().next().value
      if (floatingLink?.parentId == null) return

      try {
        const reroute = network.reroutes.get(floatingLink.parentId)
        if (!reroute) throw new Error(`Invalid reroute id: [${floatingLink.parentId}] for floating link id: [${floatingLink.id}].`)

        const renderLink = new FloatingRenderLink(network, floatingLink, "input", reroute)
        const mayContinue = this.events.dispatch("before-move-input", renderLink)
        if (mayContinue === false) return

        renderLinks.push(renderLink)
      } catch (error) {
        console.warn(`Could not create render link for link id: [${floatingLink.id}].`, floatingLink, error)
      }

      floatingLink._dragging = true
      this.floatingLinks.push(floatingLink)
    } else {
      const link = network.links.get(linkId)
      if (!link) return

      try {
        const reroute = network.getReroute(link.parentId)
        const renderLink = new MovingInputLink(network, link, reroute)

        const mayContinue = this.events.dispatch("before-move-input", renderLink)
        if (mayContinue === false) return

        renderLinks.push(renderLink)

        this.listenUntilReset("input-moved", (e) => {
          e.detail.link.disconnect(network, "output")
        })
      } catch (error) {
        console.warn(`Could not create render link for link id: [${link.id}].`, link, error)
        return
      }

      link._dragging = true
      inputLinks.push(link)
    }

    state.connectingTo = "input"
    state.draggingExistingLinks = true

    this.#setLegacyLinks(false)
  }

  /** Drag all links from an output to a new output. */
  moveOutputLink(network: LinkNetwork, output: INodeOutputSlot): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const { state, renderLinks } = this

    // Floating links
    if (output._floatingLinks?.size) {
      for (const floatingLink of output._floatingLinks.values()) {
        try {
          const reroute = LLink.getFirstReroute(network, floatingLink)
          if (!reroute) throw new Error(`Invalid reroute id: [${floatingLink.parentId}] for floating link id: [${floatingLink.id}].`)

          const renderLink = new FloatingRenderLink(network, floatingLink, "output", reroute)
          const mayContinue = this.events.dispatch("before-move-output", renderLink)
          if (mayContinue === false) continue

          renderLinks.push(renderLink)
          this.floatingLinks.push(floatingLink)
        } catch (error) {
          console.warn(`Could not create render link for link id: [${floatingLink.id}].`, floatingLink, error)
        }
      }
    }

    // Normal links
    if (output.links?.length) {
      for (const linkId of output.links) {
        const link = network.links.get(linkId)
        if (!link) continue

        const firstReroute = LLink.getFirstReroute(network, link)
        if (firstReroute) {
          firstReroute._dragging = true
          this.hiddenReroutes.add(firstReroute)
        } else {
          link._dragging = true
        }
        this.outputLinks.push(link)

        try {
          const renderLink = new MovingOutputLink(network, link, firstReroute, LinkDirection.RIGHT)

          const mayContinue = this.events.dispatch("before-move-output", renderLink)
          if (mayContinue === false) continue

          renderLinks.push(renderLink)
        } catch (error) {
          console.warn(`Could not create render link for link id: [${link.id}].`, link, error)
          continue
        }
      }
    }

    if (renderLinks.length === 0) return

    state.draggingExistingLinks = true
    state.multi = true
    state.connectingTo = "output"

    this.#setLegacyLinks(true)
  }

  /**
   * Drags a new link from an output slot to an input slot.
   * @param network The network that the link being connected belongs to
   * @param node The node the link is being dragged from
   * @param output The output slot that the link is being dragged from
   */
  dragNewFromOutput(network: LinkNetwork, node: LGraphNode, output: INodeOutputSlot, fromReroute?: Reroute): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const { state } = this
    const renderLink = new ToInputRenderLink(network, node, output, fromReroute)
    this.renderLinks.push(renderLink)

    state.connectingTo = "input"

    this.#setLegacyLinks(false)
  }

  /**
   * Drags a new link from an input slot to an output slot.
   * @param network The network that the link being connected belongs to
   * @param node The node the link is being dragged from
   * @param input The input slot that the link is being dragged from
   */
  dragNewFromInput(network: LinkNetwork, node: LGraphNode, input: INodeInputSlot, fromReroute?: Reroute): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const { state } = this
    const renderLink = new ToOutputRenderLink(network, node, input, fromReroute)
    this.renderLinks.push(renderLink)

    state.connectingTo = "output"

    this.#setLegacyLinks(true)
  }

  /**
   * Drags a new link from a reroute to an input slot.
   * @param network The network that the link being connected belongs to
   * @param reroute The reroute that the link is being dragged from
   */
  dragFromReroute(network: LinkNetwork, reroute: Reroute): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const link = reroute.firstLink ?? reroute.firstFloatingLink
    if (!link) return

    const outputNode = network.getNodeById(link.origin_id)
    if (!outputNode) return

    const outputSlot = outputNode.outputs.at(link.origin_slot)
    if (!outputSlot) return

    const renderLink = new ToInputRenderLink(network, outputNode, outputSlot, reroute)
    renderLink.fromDirection = LinkDirection.NONE
    this.renderLinks.push(renderLink)

    this.state.connectingTo = "input"

    this.#setLegacyLinks(false)
  }

  dragFromLinkSegment(network: LinkNetwork, linkSegment: LinkSegment): void {
    if (this.isConnecting) throw new Error("Already dragging links.")

    const { state } = this
    if (linkSegment.origin_id == null || linkSegment.origin_slot == null) return

    const node = network.getNodeById(linkSegment.origin_id)
    if (!node) return

    const slot = node.outputs.at(linkSegment.origin_slot)
    if (!slot) return

    const reroute = network.getReroute(linkSegment.parentId)
    const renderLink = new ToInputRenderLink(network, node, slot, reroute)
    renderLink.fromDirection = LinkDirection.NONE
    this.renderLinks.push(renderLink)

    state.connectingTo = "input"

    this.#setLegacyLinks(false)
  }

  /**
   * Connects the links being droppe
   * @param event Contains the drop location, in canvas space
   */
  dropLinks(locator: ItemLocator, event: CanvasPointerEvent): void {
    if (!this.isConnecting) {
      console.warn("Attempted to drop links when not connecting to anything.")
      return
    }

    const { renderLinks } = this
    const mayContinue = this.events.dispatch("before-drop-links", { renderLinks, event })
    if (mayContinue === false) return

    const { canvasX, canvasY } = event
    const node = locator.getNodeOnPos(canvasX, canvasY) ?? undefined
    if (node) {
      this.dropOnNode(node, event)
    } else {
      // Get reroute if no node is found
      const reroute = locator.getRerouteOnPos(canvasX, canvasY)
      // Drop output->input link on reroute is not impl.
      if (reroute && this.isRerouteValidDrop(reroute)) {
        this.dropOnReroute(reroute, event)
      } else {
        this.dropOnNothing(event)
      }
    }

    this.events.dispatch("after-drop-links", { renderLinks, event })
  }

  dropOnNode(node: LGraphNode, event: CanvasPointerEvent) {
    const { renderLinks, state } = this
    const { connectingTo } = state
    const { canvasX, canvasY } = event

    // Do nothing if every connection would loop back
    if (renderLinks.every(link => link.node === node)) return

    // To output
    if (connectingTo === "output") {
      const output = node.getOutputOnPos([canvasX, canvasY])

      if (output) {
        this.#dropOnOutput(node, output)
      } else {
        this.connectToNode(node, event)
      }
    // To input
    } else if (connectingTo === "input") {
      const input = node.getInputOnPos([canvasX, canvasY])

      // Input slot
      if (input) {
        this.#dropOnInput(node, input)
      } else if (this.overWidget && renderLinks[0] instanceof ToInputRenderLink) {
        // Widget
        this.events.dispatch("dropped-on-widget", {
          link: renderLinks[0],
          node,
          widget: this.overWidget,
        })
        this.overWidget = undefined
      } else {
        // Node background / title
        this.connectToNode(node, event)
      }
    }
  }

  dropOnReroute(reroute: Reroute, event: CanvasPointerEvent): void {
    const mayContinue = this.events.dispatch("dropped-on-reroute", { reroute, event })
    if (mayContinue === false) return

    // Connecting to input
    if (this.state.connectingTo === "input") {
      if (this.renderLinks.length !== 1) throw new Error(`Attempted to connect ${this.renderLinks.length} input links to a reroute.`)

      const renderLink = this.renderLinks[0]

      const results = reroute.findTargetInputs()
      if (!results?.length) return

      const maybeReroutes = reroute.getReroutes()
      if (maybeReroutes === null) throw new Error("Reroute loop detected.")

      const originalReroutes = maybeReroutes.slice(0, -1).reverse()

      // From reroute to reroute
      if (renderLink instanceof ToInputRenderLink) {
        const { node, fromSlot, fromSlotIndex, fromReroute } = renderLink

        reroute.setFloatingLinkOrigin(node, fromSlot, fromSlotIndex)

        // Clean floating link IDs from reroutes about to be removed from the chain
        if (fromReroute != null) {
          for (const originalReroute of originalReroutes) {
            if (originalReroute.id === fromReroute.id) break

            for (const linkId of reroute.floatingLinkIds) {
              originalReroute.floatingLinkIds.delete(linkId)
            }
          }
        }
      }

      // Filter before any connections are re-created
      const filtered = results.filter(result => renderLink.toType === "input" && canConnectInputLinkToReroute(renderLink, result.node, result.input, reroute))

      for (const result of filtered) {
        renderLink.connectToRerouteInput(reroute, result, this.events, originalReroutes)
      }

      return
    }

    // Connecting to output
    for (const link of this.renderLinks) {
      if (link.toType !== "output") continue

      const result = reroute.findSourceOutput()
      if (!result) continue

      const { node, output } = result
      if (!link.canConnectToOutput(node, output)) continue

      link.connectToRerouteOutput(reroute, node, output, this.events)
    }
  }

  dropOnNothing(event: CanvasPointerEvent): void {
    // For external event only.
    const mayContinue = this.events.dispatch("dropped-on-canvas", event)
    if (mayContinue === false) return

    if (this.state.connectingTo === "input") {
      for (const link of this.renderLinks) {
        if (link instanceof MovingInputLink) {
          link.inputNode.disconnectInput(link.inputIndex, true)
        }
      }
    } else if (this.state.connectingTo === "output") {
      for (const link of this.renderLinks) {
        if (link instanceof MovingOutputLink) {
          link.outputNode.disconnectOutput(link.outputIndex, link.inputNode)
        }
      }
    }
  }

  /**
   * Connects the links being dropped onto a node to the first matching slot.
   * @param node The node that the links are being dropped on
   * @param event Contains the drop location, in canvas space
   */
  connectToNode(node: LGraphNode, event: CanvasPointerEvent): void {
    const { state: { connectingTo } } = this

    const mayContinue = this.events.dispatch("dropped-on-node", { node, event })
    if (mayContinue === false) return

    // Assume all links are the same type, disallow loopback
    const firstLink = this.renderLinks[0]
    if (!firstLink) return

    // Use a single type check before looping; ensures all dropped links go to the same slot
    if (connectingTo === "output") {
      // Dropping new output link
      const output = node.findOutputByType(firstLink.fromSlot.type)?.slot
      if (!output) {
        console.warn(`Could not find slot for link type: [${firstLink.fromSlot.type}].`)
        return
      }

      this.#dropOnOutput(node, output)
    } else if (connectingTo === "input") {
      // Dropping new input link
      const input = node.findInputByType(firstLink.fromSlot.type)?.slot
      if (!input) {
        console.warn(`Could not find slot for link type: [${firstLink.fromSlot.type}].`)
        return
      }

      this.#dropOnInput(node, input)
    }
  }

  #dropOnInput(node: LGraphNode, input: INodeInputSlot): void {
    for (const link of this.renderLinks) {
      if (!link.canConnectToInput(node, input)) continue

      link.connectToInput(node, input, this.events)
    }
  }

  #dropOnOutput(node: LGraphNode, output: INodeOutputSlot): void {
    for (const link of this.renderLinks) {
      if (!link.canConnectToOutput(node, output)) {
        if (link instanceof MovingOutputLink && link.link.parentId !== undefined) {
          // Reconnect link without reroutes
          link.outputNode.connectSlots(link.outputSlot, link.inputNode, link.inputSlot, undefined!)
        }
        continue
      }

      link.connectToOutput(node, output, this.events)
    }
  }

  isNodeValidDrop(node: LGraphNode): boolean {
    if (this.state.connectingTo === "output") {
      return node.outputs.some(output => this.renderLinks.some(link => link.canConnectToOutput(node, output)))
    }

    // If the node has widgets, some of them might be able to be converted to
    // input slots on drop. The logic is handled in
    // https://github.com/Comfy-Org/ComfyUI_frontend/blob/4d35d937cfec5dd802fc1b24916883293f3cbb9e/src/extensions/core/widgetInputs.ts#L670-L695
    if (node.widgets?.length) {
      return true
    }

    return node.inputs.some(input => this.renderLinks.some(link => link.canConnectToInput(node, input)))
  }

  /**
   * Checks if a reroute is a valid drop target for any of the links being connected.
   * @param reroute The reroute that would be dropped on.
   * @returns `true` if any of the current links being connected are valid for the given reroute.
   */
  isRerouteValidDrop(reroute: Reroute): boolean {
    if (this.state.connectingTo === "input") {
      const results = reroute.findTargetInputs()
      if (!results?.length) return false

      for (const { node, input } of results) {
        for (const renderLink of this.renderLinks) {
          if (renderLink.toType !== "input") continue
          if (canConnectInputLinkToReroute(renderLink, node, input, reroute)) return true
        }
      }
    } else {
      const result = reroute.findSourceOutput()
      if (!result) return false

      const { node, output } = result

      for (const renderLink of this.renderLinks) {
        if (renderLink.toType !== "output") continue
        if (!renderLink.canConnectToReroute(reroute)) continue
        if (renderLink.canConnectToOutput(node, output)) return true
      }
    }

    return false
  }

  /** Sets connecting_links, used by some extensions still. */
  #setLegacyLinks(fromSlotIsInput: boolean): void {
    const links = this.renderLinks.map((link) => {
      const input = fromSlotIsInput ? link.fromSlot as INodeInputSlot : null
      const output = fromSlotIsInput ? null : link.fromSlot as INodeOutputSlot

      const afterRerouteId = link instanceof MovingLinkBase ? link.link?.parentId : link.fromReroute?.id

      return {
        node: link.node,
        slot: link.fromSlotIndex,
        input,
        output,
        pos: link.fromPos,
        afterRerouteId,
      } satisfies ConnectingLink
    })
    this.#setConnectingLinks(links)
  }

  /**
   * Exports the current state of the link connector.
   * @param network The network that the links being connected belong to.
   * @returns A POJO with the state of the link connector, links being connected, and their network.
   * @remarks Other than {@link network}, all properties are shallow cloned.
   */
  export(network: LinkNetwork): LinkConnectorExport {
    return {
      renderLinks: [...this.renderLinks],
      inputLinks: [...this.inputLinks],
      outputLinks: [...this.outputLinks],
      floatingLinks: [...this.floatingLinks],
      state: { ...this.state },
      network,
    }
  }

  /**
   * Adds an event listener that will be automatically removed when the reset event is fired.
   * @param eventName The event to listen for.
   * @param listener The listener to call when the event is fired.
   */
  listenUntilReset<K extends keyof LinkConnectorEventMap>(
    eventName: K,
    listener: Parameters<typeof this.events.addEventListener<K>>[1],
    options?: Parameters<typeof this.events.addEventListener<K>>[2],
  ) {
    this.events.addEventListener(eventName, listener, options)
    this.events.addEventListener("reset", () => this.events.removeEventListener(eventName, listener), { once: true })
  }

  /**
   * Resets everything to its initial state.
   *
   * Effectively cancels moving or connecting links.
   */
  reset(force = false): void {
    const mayContinue = this.events.dispatch("reset", force)
    if (mayContinue === false) return

    const { state, outputLinks, inputLinks, hiddenReroutes, renderLinks, floatingLinks } = this

    if (!force && state.connectingTo === undefined) return
    state.connectingTo = undefined

    for (const link of outputLinks) delete link._dragging
    for (const link of inputLinks) delete link._dragging
    for (const link of floatingLinks) delete link._dragging
    for (const reroute of hiddenReroutes) delete reroute._dragging

    renderLinks.length = 0
    inputLinks.length = 0
    outputLinks.length = 0
    floatingLinks.length = 0
    hiddenReroutes.clear()
    state.multi = false
    state.draggingExistingLinks = false
  }
}

/** Validates that a single {@link RenderLink} can be dropped on the specified reroute. */
function canConnectInputLinkToReroute(
  link: ToInputRenderLink | MovingInputLink | FloatingRenderLink,
  inputNode: LGraphNode,
  input: INodeInputSlot,
  reroute: Reroute,
): boolean {
  const { fromReroute } = link

  if (
    !link.canConnectToInput(inputNode, input) ||
    // Would result in no change
    fromReroute?.id === reroute.id ||
    // Cannot connect from child to parent reroute
    fromReroute?.getReroutes()?.includes(reroute)
  ) {
    return false
  }

  // Would result in no change
  if (link instanceof ToInputRenderLink) {
    if (reroute.parentId == null) {
      // Link would make no change - output to reroute
      if (reroute.firstLink?.hasOrigin(link.node.id, link.fromSlotIndex)) return false
    } else if (link.fromReroute?.id === reroute.parentId) {
      return false
    }
  }
  return true
}
