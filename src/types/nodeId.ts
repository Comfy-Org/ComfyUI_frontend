export type SerializedNodeId = number | string

export type NodeId = string & { readonly __brand: 'NodeId' }

type ToNodeIdInput = number | (string & { readonly __brand?: never })

export function toNodeId(value: ToNodeIdInput): NodeId {
  return String(value) as NodeId
}

export function compareNodeIds(left: NodeId, right: NodeId): number {
  const integerPattern = /^[+-]?\d+$/
  const leftInteger = integerPattern.test(left) ? BigInt(left) : undefined
  const rightInteger = integerPattern.test(right) ? BigInt(right) : undefined
  const lexicalOrder = left < right ? -1 : left > right ? 1 : 0

  if (leftInteger !== undefined && rightInteger !== undefined) {
    return leftInteger < rightInteger
      ? -1
      : leftInteger > rightInteger
        ? 1
        : lexicalOrder
  }
  if (leftInteger !== undefined) return -1
  if (rightInteger !== undefined) return 1
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
