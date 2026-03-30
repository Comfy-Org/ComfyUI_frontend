import {
  LGraphCanvas,
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISlotType, LLink } from '@/lib/litegraph/src/litegraph'

import { app } from '@/scripts/app'

/** Returns true when the node is a SetNode (fallback or kjnodes). */
function isSetNode(node: LGraphNode): boolean {
  return node.type === 'SetNode'
}

/**
 * Applies a color scheme to a node based on its resolved slot type, mirroring
 * kjnodes' `setColorAndBgColor` so fallback nodes stay visually consistent.
 */
function applyTypeColor(node: LGraphNode, type: ISlotType) {
  const typeStr = String(type)
  const nodeColors = LGraphCanvas.node_colors
  const typeColorMap: Record<string, { color: string; bgcolor: string }> = {
    MODEL: nodeColors.blue,
    LATENT: nodeColors.purple,
    VAE: nodeColors.red,
    CONDITIONING: nodeColors.brown,
    CLIP: nodeColors.yellow,
    FLOAT: nodeColors.green,
    MASK: { color: '#1c5715', bgcolor: '#1f401b' },
    INT: { color: '#1b4669', bgcolor: '#29699c' },
    CONTROL_NET: { color: '#156653', bgcolor: '#1c453b' },
    IMAGE: { color: '#1b4d6e', bgcolor: '#1d6087' }
  }
  const colors = typeColorMap[typeStr]
  if (colors) {
    node.color = colors.color
    node.bgcolor = colors.bgcolor
  } else {
    node.color = undefined
    node.bgcolor = undefined
  }
}

/**
 * Provides SetNode and GetNode as frontend-only fallbacks when the kjnodes
 * backend extension is not available or fails to register them.
 *
 * Also patches every GetNode instance (whether from kjnodes or our fallback)
 * to support an optional `default` input: when no active SetNode with a
 * matching Constant name is found, the value connected to `default` is used
 * instead of erroring out.
 *
 * **ADR 0008 note**: The `nodeCreated` patch monkey-patches `getInputLink` on
 * kjnodes-provided GetNode instances solely to add the `default`-input
 * fallback that kjnodes does not provide. This is a deliberate compatibility
 * shim scoped to this one method. It wraps, not replaces, the original
 * implementation so that kjnodes' cross-graph resolution continues to work.
 * When kjnodes adds native `default`-input support the patch should be removed.
 */
app.registerExtension({
  name: 'Comfy.GetNodeDefault',

  registerCustomNodes() {
    if (!LiteGraph.registered_node_types['SetNode']) {
      class SetNode extends LGraphNode {
        static override category = 'utils'

        constructor(title?: string) {
          super(title ?? 'SetNode')
          this.addWidget('text', 'Constant', '', () => {
            app.canvas?.setDirty(true, true)
          })
          this.addInput('', '*')
          this.addOutput('', '*')
          this.isVirtualNode = true
          this.serialize_widgets = true
        }

        /**
         * Resolves the virtual output to the node actually feeding this
         * SetNode's input, allowing the graph serialiser to bypass it.
         */
        override resolveVirtualOutput(
          _slot: number
        ): { node: LGraphNode; slot: number } | undefined {
          const link = this.getInputLink(0)
          if (!link || !this.graph) return undefined
          const originNode = this.graph.getNodeById(link.origin_id)
          if (!originNode) return undefined
          return { node: originNode, slot: link.origin_slot }
        }

        /** Propagates slot-type and color when the input connection changes. */
        override onConnectionsChange(
          type: number,
          _slot: number | undefined,
          _connected: boolean
        ) {
          if (type !== LiteGraph.INPUT || !this.graph) return
          this._updateType()
        }

        /** Reads the connected input type and updates slots and node color. */
        private _updateType() {
          const { graph } = this
          if (!graph) return
          const linkId = this.inputs[0]?.link
          if (linkId == null) {
            this.inputs[0].type = '*'
            this.outputs[0].type = '*'
            this.color = undefined
            this.bgcolor = undefined
            app.canvas?.setDirty(true, true)
            return
          }
          const link = graph.links.get(linkId)
          if (!link) return
          const originNode = graph.getNodeById(link.origin_id)
          const resolvedType: ISlotType =
            originNode?.outputs[link.origin_slot]?.type ?? '*'
          this.inputs[0].type = resolvedType
          this.outputs[0].type = resolvedType
          applyTypeColor(this, resolvedType)
          app.canvas?.setDirty(true, true)
        }
      }

      LiteGraph.registerNodeType(
        'SetNode',
        Object.assign(SetNode, { title: 'SetNode' })
      )
      SetNode.category = 'utils'
    }

    if (!LiteGraph.registered_node_types['GetNode']) {
      class GetNode extends LGraphNode {
        static override category = 'utils'

        constructor(title?: string) {
          super(title ?? 'GetNode')
          this.addWidget('text', 'Constant', '', () => {
            app.canvas?.setDirty(true, true)
          })
          this.addInput('default', '*')
          this.addOutput('', '*')
          this.isVirtualNode = true
          this.serialize_widgets = true
        }

        /**
         * Resolves the virtual output to the node that should supply this
         * GetNode's value: either a matching SetNode or the `default` input.
         */
        override resolveVirtualOutput(
          _slot: number
        ): { node: LGraphNode; slot: number } | undefined {
          return this._resolveSource()
        }

        /**
         * Returns the link that feeds this GetNode's effective input.
         *
         * When a matching SetNode is found, returns the link connected to
         * that SetNode's input (slot 0 only — SetNode has a single input).
         * Falls back to the link on the `default` input when no SetNode
         * matches.
         */
        override getInputLink(_slot: number): LLink | null {
          const resolved = this._resolveSource()
          if (resolved) {
            const inLink = resolved.node.inputs?.[resolved.slot]?.link
            if (inLink != null)
              return (
                this.graph?.links.get(inLink) ??
                this.graph?._links?.get(inLink) ??
                null
              )
          }
          const defaultInput = this.inputs?.[0]
          if (defaultInput?.link != null && this.graph?._links) {
            return this.graph._links.get(defaultInput.link) ?? null
          }
          return null
        }

        /**
         * Finds the node and slot that should supply this GetNode's value.
         *
         * Searches for an active SetNode whose Constant widget matches this
         * node's Constant name. If none is found, resolves through the
         * `default` input instead.
         */
        private _resolveSource():
          | { node: LGraphNode; slot: number }
          | undefined {
          const { graph } = this
          if (!graph) return undefined
          const constantName = this.widgets?.[0]?.value as string
          if (!constantName) return undefined

          const setter = graph.nodes.find(
            (n) =>
              isSetNode(n) &&
              n.mode !== LGraphEventMode.NEVER &&
              n.inputs?.[0]?.link != null &&
              (n.widgets?.[0]?.value as string) === constantName
          )
          if (setter) return { node: setter, slot: 0 }

          // Fall back to the connected default input
          const defaultInput = this.inputs?.[0]
          if (defaultInput?.link == null || !this.graph?._links)
            return undefined
          const defaultLink = this.graph._links.get(defaultInput.link)
          if (!defaultLink) return undefined
          const originNode = graph.getNodeById(defaultLink.origin_id)
          if (!originNode) return undefined
          return { node: originNode, slot: defaultLink.origin_slot }
        }
      }

      LiteGraph.registerNodeType(
        'GetNode',
        Object.assign(GetNode, { title: 'GetNode' })
      )
      GetNode.category = 'utils'
    }
  },

  /**
   * Patches kjnodes-provided GetNode instances to add the `default` input
   * and the fallback resolution logic that kjnodes does not include natively.
   *
   * The original `getInputLink` is preserved and called first so that
   * kjnodes' cross-graph (subgraph) resolution continues to work. This patch
   * should be removed once kjnodes ships native `default`-input support.
   */
  nodeCreated(node: LGraphNode) {
    if (node.type !== 'GetNode') return
    if (node.inputs?.some((i) => i.name === 'default')) return

    node.addInput('default', '*')

    const originalGetInputLink = node.getInputLink.bind(node)
    node.getInputLink = function (slot: number): LLink | null {
      const name = this.widgets?.[0]?.value as string | undefined
      const graph = this.graph as
        | (typeof this.graph & { _nodes?: LGraphNode[] })
        | undefined

      if (name && graph?._nodes) {
        const setter = graph._nodes.find(
          (n) =>
            isSetNode(n) &&
            n.mode !== LGraphEventMode.NEVER &&
            (n.widgets?.[0]?.value as string) === name
        )
        if (setter) {
          if (slot === 0) {
            const slotInfo = setter.inputs?.[0]
            if (slotInfo?.link != null) {
              return graph._links?.get(slotInfo.link) ?? null
            }
          }
          // Setter found but its input is unconnected — fall through to default
        }
      }

      // Try original implementation first (handles cross-graph cases in kjnodes)
      const originalResult = originalGetInputLink(slot)
      if (originalResult) return originalResult

      // Fall back to the connected default input
      const defaultInput = this.inputs?.find((i) => i.name === 'default')
      if (defaultInput?.link != null && graph?._links) {
        return graph._links.get(defaultInput.link) ?? null
      }
      return null
    }
  }
})
