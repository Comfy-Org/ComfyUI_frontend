export type SerializedNodeId = number | string

export type NodeId = string & { readonly __brand: 'NodeId' }

type ToNodeIdInput = number | (string & { readonly __brand?: never })

export function toNodeId(value: ToNodeIdInput): NodeId {
  return String(value) as NodeId
}

export function compareNodeIds(left: NodeId, right: NodeId): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftIsNumber = Number.isFinite(leftNumber)
  const rightIsNumber = Number.isFinite(rightNumber)
  const lexicalOrder = left < right ? -1 : left > right ? 1 : 0

  if (leftIsNumber && rightIsNumber) {
    return leftNumber - rightNumber || lexicalOrder
  }
  if (leftIsNumber) return -1
  if (rightIsNumber) return 1
  return lexicalOrder
}

export const UNASSIGNED_NODE_ID = toNodeId(-1)

export function serializeNodeId(value: SerializedNodeId): SerializedNodeId {
  if (typeof value === 'number') return value

  const numericValue = Number(value)
  return Number.isInteger(numericValue) && String(numericValue) === value
    ? numericValue
    : value
}

export function parseNodeId(value: unknown): NodeId | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? toNodeId(value) : null
  }

  if (typeof value === 'string') {
    return value.length > 0 ? toNodeId(value) : null
  }

  return null
}
