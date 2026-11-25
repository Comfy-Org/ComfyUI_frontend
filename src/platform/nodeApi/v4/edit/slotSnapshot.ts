import type { ISlotType } from '@comfyorg/graph-model/interfaces'

import {
  inputHasLink,
  outputHasLinks
} from '@/lib/litegraph/src/node/slotLinks'

import type { SlotSnapshot } from '@/platform/nodeApi/v4/types'
import type { LiveSlot } from './liveSlot'
import { slotIdOf } from './slotIds'
import { slotDirectionName, slotShapeName } from './slotVocabulary'

/** A slot's type as a name; a slot that accepts several reads as them joined by commas. */
export function slotTypeOf(slot: { readonly type: ISlotType }): string {
  return String(slot.type)
}

export function isSlotConnected({
  graph,
  node,
  index,
  side
}: LiveSlot): boolean {
  return side === 'input'
    ? inputHasLink(graph, node.id, index)
    : outputHasLinks(graph, node.id, index)
}

export function slotSnapshotOf(live: LiveSlot): SlotSnapshot {
  const { slot, index } = live
  return Object.freeze({
    id: slotIdOf(slot),
    index,
    name: slot.name,
    type: slotTypeOf(slot),
    label: slot.label,
    localizedName: slot.localized_name,
    position: slot.pos && Object.freeze({ x: slot.pos[0], y: slot.pos[1] }),
    direction: slotDirectionName(slot.dir),
    shape: slotShapeName(slot.shape),
    isConnected: isSlotConnected(live)
  })
}
