import type {
  SubgraphInput,
  SubgraphNode
} from '@comfyorg/graph-model/entityRegistry'

/** The subgraph node's input bound to `subgraphInput`. */
export function hostInputOf(
  subgraphNode: SubgraphNode,
  subgraphInput: SubgraphInput | undefined
) {
  return (
    subgraphInput &&
    subgraphNode.inputs.find((input) => input._subgraphSlot === subgraphInput)
  )
}
