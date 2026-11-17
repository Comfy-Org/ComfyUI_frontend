import type { GraphScopes } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import { createEditRunner } from './editRunner'
import type { EditHistory, EditRunner } from './editRunner'
import { createGraphEdits } from './graphEdits'
import type { GraphEdits } from './graphEdits'
import { createGroupEdits } from './groupEdits'
import type { GroupEdits } from './groupEdits'
import type { GroupHandles } from './groupHandles'
import { createLinkEdits } from './linkEdits'
import type { LinkEdits } from './linkEdits'
import type { SlotHandles } from './liveSlot'
import { createNodeEdits } from './nodeEdits'
import type { NodeEdits } from './nodeEdits'
import { createSlotEdits } from './slotEdits'
import type { SlotEdits } from './slotEdits'

/** `comfy.edit`, taking anything a pack passes: the only place the API changes the document. */
export type EditCore = NodeEdits &
  GraphEdits &
  GroupEdits &
  SlotEdits &
  LinkEdits &
  Pick<EditRunner, 'batch'>

export function createEdits(
  nodes: NodeHandles,
  scopes: GraphScopes,
  slots: SlotHandles,
  groups: Pick<GroupHandles, 'locator'>,
  history: () => EditHistory | undefined
): EditCore {
  const runner = createEditRunner(history)
  return Object.freeze({
    ...createNodeEdits(nodes, runner),
    ...createGraphEdits(nodes, scopes, runner),
    ...createGroupEdits(groups, runner),
    ...createSlotEdits(nodes, slots, runner),
    ...createLinkEdits(nodes, slots, runner),
    batch: runner.batch
  })
}
