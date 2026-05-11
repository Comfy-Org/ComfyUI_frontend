/**
 * RerouteNode — annotated port to the v2 extension API.
 *
 * v1 used `registerCustomNodes` to call `LiteGraph.registerNodeType()` with
 * a class that heavily overrides LiteGraph node behaviour (`onConnectionsChange`,
 * `clone`, `computeSize`, `getExtraMenuOptions`).
 *
 * RerouteNode is the *most v1-coupled* core extension: its entire value lives
 * in LiteGraph prototype methods. It is the intentional hard case for this
 * conversion exercise.
 *
 * What this file demonstrates to Simon/Austin:
 *  1. The `defineNodeExtension` pattern works only for *per-instance hooks*
 *     — events that fire after a node exists. LiteGraph prototype overrides
 *     (`onConnectionsChange`, `computeSize`, `clone`) fire synchronously
 *     inside LiteGraph's own rendering loop and have no v2 equivalent.
 *  2. Custom context-menu contributions (`getExtraMenuOptions`) have no v2
 *     surface. This is intentionally out of scope for the initial API.
 *  3. `localStorage` / settings persistence (`defaultVisibility`) works the
 *     same in v2 — no v2 API involvement needed.
 *
 * API GAPS (feedback items for Simon/Austin):
 *  GAP-1: (same as noteNode.v2) No `registerNodeTypes` hook — custom LiteGraph
 *         node types cannot be registered via the v2 API.
 *  GAP-7: No v2 hook for `onConnectionsChange`. This is a hot-path LiteGraph
 *         callback that fires during canvas interaction. Mapping it to the v2
 *         model would require an `NodeConnectedEvent` / `NodeDisconnectedEvent`
 *         that fires SYNCHRONOUSLY and allows the handler to mutate outputs
 *         and downstream nodes. Current v2 `node.on('connected')` is async-safe
 *         and does not support synchronous output-type mutation.
 *  GAP-8: No v2 surface for `getExtraMenuOptions` (context menu extension).
 *         Would need an `onContextMenu(items)` hook on NodeExtensionOptions
 *         that allows item injection.
 *  GAP-9: `clone()` override. No v2 equivalent. If we want the cloned reroute
 *         node to have its output reset, we'd need a post-copy lifecycle hook
 *         (e.g. `nodeCopied(clone, source)`) which D12 explicitly deferred.
 *  GAP-10: `computeSize()` override. Pure LiteGraph geometry; unlikely to
 *          ever have a v2 equivalent. Extensions that need custom size should
 *          either accept a fixed size or use a separate API.
 *
 * Conclusion: RerouteNode cannot be converted to pure v2 in the current API.
 * It is a LiteGraph-native "virtual node" with synchronous connection-type
 * propagation logic. The correct long-term path is to make RerouteNode a
 * first-class feature of the ComfyUI graph engine (not an extension at all)
 * and expose its behaviour through a higher-level abstraction.
 *
 * What *can* be expressed in v2 is shown in the `defineNodeExtension` block
 * below — the per-instance "user changed show/hide type" preference is a clean
 * v2 pattern. The rest remains in the v1 bridge.
 */

import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import { getWidgetConfig, mergeIfValid, setWidgetConfig } from './widgetInputs'
import { defineExtension } from '@/extension-api'

// ── GAP-1: Interim bridge — LiteGraph node type registration ─────────────────

function registerRerouteType() {
  // Declaration-merging interface so the class gains `__outputType`.
  interface RerouteNode extends LGraphNode {
    __outputType?: string | number
  }

  class RerouteNode extends LGraphNode {
    static override category: string | undefined
    static defaultVisibility = false

    constructor(title?: string) {
      super(title ?? '')
      if (!this.properties) this.properties = {}
      this.properties.showOutputText = RerouteNode.defaultVisibility
      this.properties.horizontal = false
      this.addInput('', '*')
      this.addOutput(this.properties.showOutputText ? '*' : '', '*')
      this.setSize(this.computeSize())
      this.isVirtualNode = true
    }

    override onAfterGraphConfigured() {
      requestAnimationFrame(() => {
        this.onConnectionsChange(LiteGraph.INPUT, undefined, true)
      })
    }

    // GAP-9: This clone() override would need a v2 `nodeCopied` lifecycle hook.
    override clone(): LGraphNode | null {
      const cloned = super.clone()
      if (!cloned) return cloned
      cloned.removeOutput(0)
      cloned.addOutput(this.properties.showOutputText ? '*' : '', '*')
      cloned.setSize(cloned.computeSize())
      return cloned
    }

    // GAP-7: onConnectionsChange cannot be expressed in v2 — synchronous
    // output-type mutation during connection is not supported by v2 event model.
    override onConnectionsChange(
      type: ISlotType,
      _index: number | undefined,
      connected: boolean
    ) {
      const { graph } = this
      if (!graph) return
      // @ts-expect-error ComfyApp
      if (globalThis.app?.configuringGraph) return

      if (connected && type === LiteGraph.OUTPUT) {
        const types = new Set(
          this.outputs[0].links
            ?.map((l) => graph.links[l]?.type)
            ?.filter((t) => t && t !== '*') ?? []
        )
        if (types.size > 1) {
          const linksToDisconnect = []
          for (const linkId of this.outputs[0].links ?? []) {
            linksToDisconnect.push(graph.links[linkId])
          }
          linksToDisconnect.pop()
          for (const link of linksToDisconnect) {
            if (!link) continue
            const node = graph.getNodeById(link.target_id)
            node?.disconnectInput(link.target_slot)
          }
        }
      }

      let currentNode: RerouteNode | null = this
      let updateNodes: RerouteNode[] = []
      let inputType = null
      let inputNode = null
      while (currentNode) {
        updateNodes.unshift(currentNode)
        const linkId = currentNode.inputs[0].link
        if (linkId !== null) {
          const link = graph.links[linkId]
          if (!link) return
          const node = graph.getNodeById(link.origin_id)
          if (!node) return
          if (node instanceof RerouteNode) {
            if (node === this) {
              currentNode.disconnectInput(link.target_slot)
              currentNode = null
            } else {
              currentNode = node
            }
          } else {
            inputNode = currentNode
            inputType = node.outputs[link.origin_slot]?.type ?? null
            break
          }
        } else {
          currentNode = null
          break
        }
      }

      const nodes: RerouteNode[] = [this]
      let outputType = null
      while (nodes.length) {
        currentNode = nodes.pop()!
        const outputs = currentNode.outputs?.[0]?.links ?? []
        for (const linkId of outputs) {
          const link = graph.links[linkId]
          if (!link) continue
          const node = graph.getNodeById(link.target_id)
          if (!node) continue
          if (node instanceof RerouteNode) {
            nodes.push(node)
            updateNodes.push(node)
          } else {
            const nodeInput = node.inputs[link.target_slot]
            const nodeOutType = nodeInput.type
            const keep =
              !inputType ||
              !nodeOutType ||
              LiteGraph.isValidConnection(inputType, nodeOutType)
            if (!keep) {
              node.disconnectInput(link.target_slot)
              continue
            }
            node.onConnectionsChange?.(
              LiteGraph.INPUT,
              link.target_slot,
              keep,
              link,
              nodeInput
            )
            outputType = node.inputs[link.target_slot].type
          }
        }
      }

      const displayType = inputType || outputType || '*'
      const color = LGraphCanvas.link_type_colors[displayType]

      let widgetConfig
      let widgetType
      for (const node of updateNodes) {
        node.outputs[0].type = inputType || '*'
        node.__outputType = displayType
        node.outputs[0].name = node.properties.showOutputText ? `${displayType}` : ''
        node.setSize(node.computeSize())
        for (const l of node.outputs[0].links || []) {
          const link = graph.links[l]
          if (!link) continue
          link.color = color
          // @ts-expect-error ComfyApp
          if (globalThis.app?.configuringGraph) continue
          const targetNode = graph.getNodeById(link.target_id)
          if (!targetNode) continue
          const targetInput = targetNode.inputs?.[link.target_slot]
          if (targetInput?.widget) {
            const config = getWidgetConfig(targetInput)
            if (!widgetConfig) {
              widgetConfig = config[1] ?? {}
              widgetType = config[0]
            }
            const merged = mergeIfValid(targetInput, [config[0], widgetConfig])
            if (merged.customConfig) widgetConfig = merged.customConfig
          }
        }
      }

      for (const node of updateNodes) {
        if (widgetConfig && outputType) {
          node.inputs[0].widget = { name: 'value' }
          setWidgetConfig(node.inputs[0], [widgetType ?? `${displayType}`, widgetConfig])
        } else {
          setWidgetConfig(node.inputs[0], undefined)
        }
      }

      if (inputNode?.inputs?.[0]?.link) {
        const link = graph.links[inputNode.inputs[0].link]
        if (link) link.color = color
      }
    }

    // GAP-8: getExtraMenuOptions has no v2 equivalent.
    override getExtraMenuOptions(
      _: unknown,
      options: (IContextMenuValue | null)[]
    ): IContextMenuValue[] {
      options.unshift(
        {
          content: (this.properties.showOutputText ? 'Hide' : 'Show') + ' Type',
          callback: () => {
            this.properties.showOutputText = !this.properties.showOutputText
            if (this.properties.showOutputText) {
              this.outputs[0].name = `${this.__outputType || this.outputs[0].type}`
            } else {
              this.outputs[0].name = ''
            }
            this.setSize(this.computeSize())
            // @ts-expect-error ComfyApp
            globalThis.app?.canvas?.setDirty(true, true)
          }
        },
        {
          content:
            (RerouteNode.defaultVisibility ? 'Hide' : 'Show') +
            ' Type By Default',
          callback: () => {
            RerouteNode.setDefaultTextVisibility(!RerouteNode.defaultVisibility)
          }
        }
      )
      return []
    }

    // GAP-10: computeSize override — no v2 surface.
    override computeSize(): [number, number] {
      return [
        this.properties.showOutputText && this.outputs?.length
          ? Math.max(
              75,
              LiteGraph.NODE_TEXT_SIZE * this.outputs[0].name.length * 0.6 + 40
            )
          : 75,
        26
      ]
    }

    static setDefaultTextVisibility(visible: boolean) {
      RerouteNode.defaultVisibility = visible
      if (visible) {
        localStorage['Comfy.RerouteNode.DefaultVisibility'] = 'true'
      } else {
        delete localStorage['Comfy.RerouteNode.DefaultVisibility']
      }
    }
  }

  RerouteNode.setDefaultTextVisibility(
    !!localStorage['Comfy.RerouteNode.DefaultVisibility']
  )

  LiteGraph.registerNodeType(
    'Reroute',
    Object.assign(RerouteNode, {
      title_mode: LiteGraph.NO_TITLE,
      title: 'Reroute',
      collapsable: false
    })
  )
  RerouteNode.category = 'utils'
}

// ── v2: app-level registration (GAP-1 bridge) ─────────────────────────────────

defineExtension({
  name: 'Comfy.RerouteNode.V2',
  setup() {
    registerRerouteType()
  }
})

// ── v2: what *can* be expressed cleanly ──────────────────────────────────────
// The context-menu "Show/Hide Type" toggle persists a preference to localStorage.
// In a fully realized v2 API this would live here. Today it's inside the
// LiteGraph class because there's no v2 hook for per-node menu items (GAP-8).
//
// If GAP-7 (synchronous connection-type propagation) were solved, the
// onConnectionsChange logic above could become:
//
//   defineNodeExtension({
//     name: 'Comfy.RerouteNode.V2',
//     nodeTypes: ['Reroute'],
//     nodeCreated(node) {
//       node.on('connected', (e) => propagateType(node, e))
//       node.on('disconnected', (e) => propagateType(node, e))
//     }
//   })
//
// That path requires the connected/disconnected events to be synchronous
// and to carry a mutable output descriptor — a non-trivial API contract.
