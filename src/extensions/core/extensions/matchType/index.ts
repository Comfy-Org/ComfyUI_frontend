import { without } from 'es-toolkit'

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
  const connectedTypes: ISlotType[] = new Array(inputPairs.length).fill('*')
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
      const pairIndex = inputPairs.findIndex(([name]) => name === input.name)
      if (pairIndex == -1) return
      connectedTypes[pairIndex] = inputPairs[pairIndex][1]
      if (iscon && linf) {
        const { output, subgraphInput } = linf.resolve(this.graph)
        const connectingType = (output ?? subgraphInput)?.type
        if (connectingType)
          linf.type = connectedTypes[pairIndex] = connectingType
      }
      //An input slot can accept a connection that is
      // - Compatible with original type
      // - Compatible with all other input types
      //An output slot can output
      // - Only what every input can output
      for (let i = 0; i < inputPairs.length; i++) {
        //NOTE: This isn't great. Originally, I kept direct references to each
        //input, but these were becoming orphaned
        const input = this.inputs.find((inp) => inp.name === inputPairs[i][0])
        if (!input) continue
        const otherConnected = [...connectedTypes]
        otherConnected.splice(i, 1)
        const validType = combineTypes(...otherConnected, inputPairs[i][1])
        if (!validType) throw new Error('invalid connection')
        input.type = validType
      }
      if (outputs) {
        const outputType = combineTypes(...connectedTypes)
        if (!outputType) throw new Error('invalid connection')
        changeOutputType(this, outputType, outputs)
      }
    }
  )
}

function changeOutputType(
  node: LGraphNode,
  combinedType: ISlotType,
  outputs: number[]
) {
  if (!node.graph) return
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
      if (!keep && subgraphOutput) subgraphOutput.disconnect()
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
}
function isStrings(types: ISlotType[]): types is string[] {
  return !types.some((t) => typeof t !== 'string')
}

function combineTypes(...types: ISlotType[]): ISlotType | undefined {
  if (!isStrings(types)) return undefined

  const withoutWildcards = without(types, '*')
  if (withoutWildcards.length === 0) return '*'

  const typeLists: string[][] = withoutWildcards.map((type) => type.split(','))

  const combinedTypes = intersection(...typeLists)
  if (combinedTypes.length === 0) return undefined

  return combinedTypes.join(',')
}
function intersection(...sets: string[][]): string[] {
  const itemCounts: Record<string, number> = {}
  for (const set of sets)
    for (const item of new Set(set))
      itemCounts[item] = (itemCounts[item] ?? 0) + 1
  return Object.entries(itemCounts)
    .filter(([, count]) => count == sets.length)
    .map(([key]) => key)
}
