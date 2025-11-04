import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import { SubgraphSlot } from '@/lib/litegraph/src/subgraph/SubgraphSlotBase'

import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.SwitchNode',
  registerCustomNodes() {
    class SwitchNode extends LGraphNode {
      static override category: string | undefined
      static defaultVisibility = false
      linkTimeout: undefined | ReturnType<typeof setTimeout> = undefined

      constructor(title?: string) {
        super(title ?? 'switch')
        if (!this.properties) {
          this.properties = {}
        }
        this.addInput('true', '*')
        this.addInput('false', '*')
        this.addWidget('toggle', 'toggle', true, () => {}, {})
        this.addOutput('output', '*')

        // This node is purely frontend and does not impact the resulting prompt so should not be serialized
        this.isVirtualNode = true
      }
      combinedType(newType: ISlotType, slot: number): ISlotType | undefined {
        const otherType = this.inputs[slot].type
        if (typeof newType !== 'string' || typeof otherType !== 'string')
          return undefined
        if (newType === '*') return otherType
        if (otherType === '*') return newType
        const newSet = new Set(newType.split(','))
        const combinedSet = newSet.intersection(new Set(otherType.split(',')))
        if (combinedSet.size == 0) return undefined
        return [...combinedSet].join(',')
      }
      changeOutputType(combinedType: ISlotType) {
        this.linkTimeout = setTimeout(() => {
          if (!this.graph) return
          this.linkTimeout = undefined
          if (this.outputs[0].type != combinedType) {
            this.outputs[0].type = combinedType

            //check and potentially remove links
            for (let link_id of this.outputs[0].links ?? []) {
              let link = this.graph.links[link_id]
              if (!link) continue
              const { input, inputNode, subgraphOutput } = link.resolve(
                this.graph
              )
              const inputType = (input ?? subgraphOutput)?.type
              if (!inputType) continue
              const keep = LiteGraph.isValidConnection(combinedType, inputType)
              if (!keep && subgraphOutput) {
                ;(subgraphOutput as SubgraphSlot).disconnect()
              } else if (!keep && inputNode) {
                inputNode.disconnectInput(link.target_slot)
              }
              if (input && inputNode?.onConnectionsChange)
                inputNode.onConnectionsChange(
                  LiteGraph.INPUT,
                  link.target_slot,
                  keep,
                  link,
                  input
                )
            }
            app.canvas.setDirty(true, true)
          }
        }, 50)
      }
      override onConnectionsChange(
        contype: ISlotType,
        slot: number,
        iscon: boolean,
        linf: LLink | null | undefined
      ) {
        if (contype == LiteGraph.INPUT && (slot == 0 || slot == 1)) {
          if (!this.graph) return
          let newType: ISlotType | undefined = '*'
          if (iscon && linf) {
            const { output, subgraphInput } = linf.resolve(this.graph)
            newType = (output ?? subgraphInput)?.type
            if (!newType) return
          }
          if (this.linkTimeout) {
            clearTimeout(this.linkTimeout)
          }
          const combinedType = this.combinedType(newType, slot)
          //should be blocked by onConnectInput
          if (!combinedType) throw new Error('Invalid connection')
          this.inputs[slot ? 0 : 1].type = newType
          this.changeOutputType(combinedType)
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
