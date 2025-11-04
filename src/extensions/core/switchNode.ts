import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'

import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.SwitchNode',
  registerCustomNodes(app) {
    class SwitchNode extends LGraphNode {
      static override category: string | undefined
      static defaultVisibility = false
      linkTimeout: undefined | ReturnType<typeof setTimeout> = undefined

      constructor(title?: string) {
        // @ts-expect-error fixme ts strict error
        super(title)
        if (!this.properties) {
          this.properties = {}
        }
        this.addInput('true', '*')
        this.addInput('false', '*')
        this.addWidget('toggle', 'toggle', true, () => {}, {})
        this.addOutput('output', '*')

        this.onAfterGraphConfigured = function () {
          requestAnimationFrame(() => {
            // @ts-expect-error fixme ts strict error
            this.onConnectionsChange(LiteGraph.INPUT, null, true, null)
          })
        }

        // This node is purely frontend and does not impact the resulting prompt so should not be serialized
        this.isVirtualNode = true
      }
      changeType(new_type: ISlotType) {
        this.linkTimeout = setTimeout(() => {
          this.linkTimeout = undefined
          if (this.outputs[0].type != new_type) {
            this.outputs[0].type = new_type
            this.inputs[0].type = new_type
            this.inputs[1].type = new_type

            //check and potentially remove links
            if (!this.outputs[0].links) {
              return
            }
            let removed_links = []
            for (let link_id of this.outputs[0].links) {
              let link = app.graph.links[link_id]
              let target_node = app.graph.getNodeById(link.target_id)
              if (!target_node) continue
              let target_input = target_node.inputs[link.target_slot]
              let keep = LiteGraph.isValidConnection(
                new_type,
                target_input.type
              )
              if (!keep) {
                link.disconnect(app.graph, 'input')
                removed_links.push(link_id)
              }
              target_node.onConnectionsChange?.(
                LiteGraph.INPUT,
                link.target_slot,
                keep,
                link,
                target_input
              )
            }
            this.outputs[0].links = this.outputs[0].links.filter(
              (v) => !removed_links.includes(v)
            )
          }
        }, 50)
      }
      override onConnectionsChange(
        contype: ISlotType,
        slot: number,
        iscon: boolean,
        linf: LLink | null | undefined
      ) {
        if (app.configuringGraph) return
        if (contype == LiteGraph.INPUT && (slot == 0 || slot == 1)) {
          let new_type: ISlotType = '*'
          if (iscon && linf) {
            const origin_node = app.graph.getNodeById(linf.origin_id)
            if (!origin_node) return
            new_type = origin_node.outputs[linf.origin_slot].type
          }
          if (this.linkTimeout) {
            clearTimeout(this.linkTimeout)
          }
          this.changeType(new_type)
        }
      }
      override getInputLink(): LLink | null {
        return super.getInputLink(this.widgets?.[0]?.value ? 0 : 1)
      }
    }
    LiteGraph.registerNodeType(
      'Switch',
      Object.assign(SwitchNode, {
        title: 'Switch'
      })
    )
  }
})
