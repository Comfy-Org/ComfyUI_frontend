import { nodesMap } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import type { MaterializableGraph } from './agentNodeMaterializer'
import type { GraphOperation } from './graphOperations'

type ConnectOperation = Extract<GraphOperation, { op: 'connect' }>

function documentInputSlot(
  doc: Y.Doc,
  nodeId: string,
  name: string
): number | undefined {
  const value = nodesMap(doc).get(nodeId)?.get('inputs')
  if (!(value instanceof Y.Array)) return undefined
  const matches = value
    .toJSON()
    .flatMap((input: unknown, index: number) =>
      typeof input === 'object' &&
      input !== null &&
      'name' in input &&
      input.name === name
        ? [index]
        : []
    )
  return matches.length === 1 ? matches[0] : undefined
}

/** Resolves a local numeric input to its name, then to that name's document slot. */
export function mapLocalInputSlots(
  doc: Y.Doc,
  graph: Pick<MaterializableGraph, '_nodes_by_id'>,
  operations: GraphOperation[]
): GraphOperation[] {
  return operations.flatMap((operation): GraphOperation[] => {
    if (operation.op !== 'connect' || operation.grow != null) return [operation]
    const nodeId = String(operation.to_node)
    if (!nodesMap(doc).has(nodeId)) return [operation]

    const name = graph._nodes_by_id[toNodeId(nodeId)]?.inputs.at(
      operation.to_slot
    )?.name
    const toSlot =
      name === undefined ? undefined : documentInputSlot(doc, nodeId, name)
    if (toSlot === undefined) return missingInput(operation.link_id)
    return [{ ...operation, grow: null, to_slot: toSlot }]
  })
}

function missingInput(linkId: ConnectOperation['link_id']): [] {
  console.error(
    '[agent-crdt] connect input is absent from the bound document; the local graph diverges',
    linkId
  )
  return []
}
