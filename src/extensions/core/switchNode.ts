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
      combinedType(newType: ISlotType, slot: number): ISlotType | undefined {
        const otherType = this.inputs[slot === 0 ? 1 : 0].type
        if (typeof newType !== 'string' || typeof otherType !== 'string')
          return undefined
        if (newType === '*') return otherType
        if (otherType === '*') return newType
        const newSet = new Set(newType.split(','))
        // @ts-expect-error intersection doesn't exist?
        const combinedSet = newSet.intersection(new Set(otherType.split(',')))
        if (combinedSet.size == 0) return undefined
        return [...combinedSet].join(',')
      }
      changeType(newType: ISlotType, slot: number, combinedType: ISlotType) {
        this.linkTimeout = setTimeout(() => {
          if (!this.graph) return
          this.linkTimeout = undefined
          this.inputs[slot].type = newType
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
              if (
                !inputType ||
                LiteGraph.isValidConnection(combinedType, inputType)
              )
                continue
              if (inputNode) inputNode.disconnectInput(link.target_slot)
              else
                // @ts-expect-error Does exist, but fails to cleanup output links
                subgraphOutput?.disconnect()
            }
          }
        }, 50)
      }
      override onConnectionsChange(
        contype: ISlotType,
        slot: number,
        iscon: boolean,
        linf: LLink | null | undefined
      ) {
        if (app.configuringGraph || !this.graph) return
        if (contype == LiteGraph.INPUT && (slot == 0 || slot == 1)) {
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
          this.changeType(newType, slot, combinedType)
        }
      }
      override onConnectInput(targetSlot: number, type: unknown): boolean {
        if (app.configuringGraph) return true
        if (!(typeof type === 'string')) return false
        return !!this.combinedType(type, targetSlot)
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
