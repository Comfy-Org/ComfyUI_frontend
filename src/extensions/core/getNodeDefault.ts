import {
  LGraphCanvas,
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISlotType, LLink } from '@/lib/litegraph/src/litegraph'

import { app } from '@/scripts/app'

function isSetNode(node: LGraphNode): boolean {
  return node.type === 'SetNode'
}

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

        override resolveVirtualOutput(
          _slot: number
        ): { node: LGraphNode; slot: number } | undefined {
          const link = this.getInputLink(0)
          if (!link || !this.graph) return undefined
          const originNode = this.graph.getNodeById(link.origin_id)
          if (!originNode) return undefined
          return { node: originNode, slot: link.origin_slot }
        }

        override onConnectionsChange(
          type: number,
          _slot: number | undefined,
          _connected: boolean
        ) {
          if (type !== LiteGraph.INPUT || !this.graph) return
          this._updateType()
        }

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

        override resolveVirtualOutput(
          _slot: number
        ): { node: LGraphNode; slot: number } | undefined {
          return this._resolveSource()
        }

        override getInputLink(_slot: number): LLink | null {
          const resolved = this._resolveSource()
          if (resolved) {
            const link = this.graph?.getNodeById(resolved.node.id)
            if (link) {
              const outLink = resolved.node.outputs?.[resolved.slot]?.links?.[0]
              if (outLink != null) return this.graph?.links.get(outLink) ?? null
            }
          }
          const defaultInput = this.inputs?.[0]
          if (defaultInput?.link != null && this.graph?._links) {
            return this.graph._links.get(defaultInput.link) ?? null
          }
          return null
        }

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

  // Patch kjnodes' GetNode instances (if kjnodes loaded instead of our fallback)
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
