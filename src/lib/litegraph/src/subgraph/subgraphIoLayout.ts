import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@comfyorg/graph-model/uuid'

export interface SubgraphIoLayout {
  width: number
  height: number
  slotTop: number
}

export let getSubgraphIoLayout: (
  graphId: UUID,
  nodeId: NodeId
) => SubgraphIoLayout | undefined = () => undefined

export function provideSubgraphIoLayout(reader: typeof getSubgraphIoLayout) {
  getSubgraphIoLayout = reader
}
