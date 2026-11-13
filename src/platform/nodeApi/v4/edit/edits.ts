import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import { createEditRunner } from './editRunner'
import type { EditHistory, EditRunner } from './editRunner'
import { createNodeEdits } from './nodeEdits'
import type { NodeEdits } from './nodeEdits'

/** `comfy.edit`, taking anything a pack passes: the only place the API changes the document. */
export type EditCore = NodeEdits & Pick<EditRunner, 'batch'>

export function createEdits(
  nodes: NodeHandles,
  history: () => EditHistory | undefined
): EditCore {
  const runner = createEditRunner(history)
  return Object.freeze({
    ...createNodeEdits(nodes, runner),
    batch: runner.batch
  })
}
