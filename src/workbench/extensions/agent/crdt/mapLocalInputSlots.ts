import { nodesMap } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import type { MaterializableGraph } from './agentNodeMaterializer'
import type { GraphOperation } from './graphOperations'

type ConnectOperation = Extract<GraphOperation, { op: 'connect' }>
type NamedConnectOperation = ConnectOperation & {
  targetInputName: string
}

function documentInputNames(doc: Y.Doc, nodeId: string): string[] {
  const value = nodesMap(doc).get(nodeId)?.get('inputs')
  if (!(value instanceof Y.Array)) return []
  return value
    .toJSON()
    .flatMap((input: unknown) =>
      input &&
      typeof input === 'object' &&
      'name' in input &&
      typeof input.name === 'string'
        ? [input.name]
        : []
    )
}

/** Resolve a local numeric input once, then serialize its semantic name to the document slot. */
export function mapLocalInputSlots(
  doc: Y.Doc,
  graph: Pick<MaterializableGraph, '_nodes_by_id'>,
  operations: GraphOperation[]
): GraphOperation[] {
  return operations.flatMap((operation): GraphOperation[] => {
    if (operation.op !== 'connect' || operation.grow != null) return [operation]
    const nodeId = String(operation.to_node)
    if (!nodesMap(doc).has(nodeId)) return [operation]

    const targetInputName = graph._nodes_by_id[toNodeId(nodeId)]?.inputs.at(
      operation.to_slot
    )?.name
    if (targetInputName === undefined) return missingInput(operation.link_id)

    const semantic: NamedConnectOperation = { ...operation, targetInputName }
    const toSlot = documentInputNames(doc, nodeId).indexOf(
      semantic.targetInputName
    )
    if (toSlot < 0) return missingInput(operation.link_id)
    const { targetInputName: _targetInputName, ...wireOperation } = semantic
    return [{ ...wireOperation, grow: null, to_slot: toSlot }]
  })
}

function missingInput(linkId: ConnectOperation['link_id']): [] {
  console.error(
    '[agent-crdt] connect input is absent from the bound document; the local graph diverges',
    linkId
  )
  return []
}
