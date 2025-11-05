import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import { app } from '@/scripts/app'

const MATCH_TYPE = 'COMFY_MATCHTYPE_V3'

app.registerExtension({
  name: 'Comfy.MatchType',
  beforeRegisterNodeDef(nodeType, nodeData) {
    const inputs = {
      ...nodeData.input?.required,
      ...nodeData.input?.optional
    }
    if (!Object.values(inputs).some((w) => w[0] === MATCH_TYPE)) return
    nodeType.prototype.onNodeCreated = useChainCallback(
      nodeType.prototype.onNodeCreated,
      function (this: LGraphNode) {
        const inputGroups: Record<string, [string, ISlotType][]> = {}
        const outputGroups: Record<string, number[]> = {}
        for (const input of this.inputs) {
          if (input.type !== MATCH_TYPE) continue
          const template = inputs[input.name][1]?.template
          if (!template) continue
          input.type = template.allowed_types ?? '*'
          inputGroups[template.template_id] ??= []
          inputGroups[template.template_id].push([input.name, input.type])
        }
        this.outputs.forEach((output, i) => {
          if (output.type !== MATCH_TYPE) return
          const id = nodeData.output_matchtypes?.[i]
          if (id == undefined) return
          outputGroups[id] ??= []
          outputGroups[id].push(i)
        })
        for (const groupId in inputGroups) {
          addConnectionGroup(this, inputGroups[groupId], outputGroups[groupId])
        }
      }
    )
  }
})
function addConnectionGroup(
  node: LGraphNode,
  inputPairs: [string, ISlotType][],
  outputs?: number[]
) {
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
      const slotPair = inputPairs.find(([name]) => name === input.name)
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
      for (const [name] of inputPairs) {
        if (name == input.name) continue
        const inp = this.inputs.find((i) => i.name === name)
        if (!inp) continue
        inp.type = newType
      }
      if (outputs) changeOutputType(this, combinedType, timeout, outputs)
    }
  )
}

function changeOutputType(
  node: LGraphNode,
  combinedType: ISlotType,
  timeout: { value?: ReturnType<typeof setTimeout> },
  outputs: number[]
) {
  if (timeout.value) {
    clearTimeout(timeout.value)
  }
  timeout.value = setTimeout(() => {
    if (!node.graph) return
    timeout.value = undefined
    for (const index of outputs) {
      if (node.outputs[index].type === combinedType) continue
      node.outputs[index].type = combinedType

      //check and potentially remove links
      for (let link_id of node.outputs[index].links ?? []) {
        let link = node.graph.links[link_id]
        if (!link) continue
        const { input, inputNode, subgraphOutput } = link.resolve(node.graph)
        const inputType = (input ?? subgraphOutput)?.type
        if (!inputType) continue
        const keep = LiteGraph.isValidConnection(combinedType, inputType)
        if (!keep && subgraphOutput)
          //TODO: subgraphOutput.disconnect still needs cleanup
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
