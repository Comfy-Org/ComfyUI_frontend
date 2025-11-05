import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import { useChainCallback } from '@/composables/functional/useChainCallback'

import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.MatchType',
  beforeRegisterNodeDef(nodeType, nodeData) {
    const inputs = {
      ...nodeData.input?.required,
      ...nodeData.input?.optional
    }
    if (!Object.values(inputs).some((w) => w[0] === 'COMFY_MATCHTYPE_V3'))
      return
    nodeType.prototype.onNodeCreated = useChainCallback(
      nodeType.prototype.onNodeCreated,
      function (this: LGraphNode) {
        const connectionGroups: Record<string, [string, ISlotType][]> = {}
        for (const input of this.inputs) {
          if (input.type !== 'COMFY_MATCHTYPE_V3') continue
          const template = inputs[input.name][1]?.template
          if (!template) continue
          input.type = template.allowed_types ?? '*'
          connectionGroups[template.template_id] ??= []
          connectionGroups[template.template_id].push([input.name, input.type])
        }
        for (const connectionGroup of Object.values(connectionGroups)) {
          addConnectionGroup(this, connectionGroup)
        }
      }
    )
  }
})
function addConnectionGroup(node: LGraphNode, slots: [string, ISlotType][]) {
  const timeout = {}
  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (
      this: LGraphNode,
      contype: ISlotType,
      slot: number,
      iscon: boolean,
      linf: LLink | null | undefined
    ) {
      const input = this.inputs[slot]
      if (contype !== LiteGraph.INPUT || !this.graph || !input) return
      const slotPair = slots.find(([name]) => name === input.name)
      if (!slotPair) return
      //TODO: Generalize for >2 inputs
      let newType: ISlotType | undefined = slotPair[1]
      if (iscon && linf) {
        const { output, subgraphInput } = linf.resolve(this.graph)
        newType = (output ?? subgraphInput)?.type
        if (!newType) return
      }
      const combinedType = combineTypes(newType, input.type)
      //should be blocked by onConnectInput
      if (!combinedType) throw new Error('Invalid connection')
      //restrict the type of all OTHER inputs to combinedType
      for (const [name] of slots) {
        if (name == input.name) continue
        const inp = this.inputs.find((i) => i.name === name)
        if (!inp) continue
        inp.type = newType
      }
      changeOutputType(this, combinedType, timeout)
    }
  )
}

function changeOutputType(
  node: LGraphNode,
  combinedType: ISlotType,
  timeout: { value?: ReturnType<typeof setTimeout> }
) {
  if (timeout.value) {
    clearTimeout(timeout.value)
  }
  timeout.value = setTimeout(() => {
    if (!node.graph) return
    timeout.value = undefined
    if (node.outputs[0].type != combinedType) {
      node.outputs[0].type = combinedType

      //check and potentially remove links
      for (let link_id of node.outputs[0].links ?? []) {
        let link = node.graph.links[link_id]
        if (!link) continue
        const { input, inputNode, subgraphOutput } = link.resolve(node.graph)
        const inputType = (input ?? subgraphOutput)?.type
        if (!inputType) continue
        const keep = LiteGraph.isValidConnection(combinedType, inputType)
        if (!keep && subgraphOutput)
          // @ts-expect-error exists, but bad. need to fix
          subgraphOutput.disconnect()
        else if (!keep && inputNode) inputNode.disconnectInput(link.target_slot)
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

function isStrings(types: ISlotType[]): types is string[] {
  return !types.some((t) => typeof t !== 'string')
}

function combineTypes(...types: ISlotType[]): ISlotType | undefined {
  if (!isStrings(types)) return undefined
  const filteredTypes = types.filter((t) => t !== '*')
  if (!filteredTypes.length) return '*'
  const combinedSet = filteredTypes.reduce(
    (combined, partial) => combined.intersection(new Set(partial.split(','))),
    new Set(filteredTypes[0].split(','))
  )
  if (combinedSet.size == 0) return undefined
  return [...combinedSet].join(',')
}
