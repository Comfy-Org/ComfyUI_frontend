import type { ISlotType } from './interfaces'
import type { SerializedNodeId } from './nodeId'

export type SerialisedLLinkArray = [
  id: number,
  origin_id: SerializedNodeId,
  origin_slot: number,
  target_id: SerializedNodeId,
  target_slot: number,
  type: ISlotType
]
