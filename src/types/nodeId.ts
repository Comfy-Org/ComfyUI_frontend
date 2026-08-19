export type SerializedNodeId = number | string

export type NodeId = string & { readonly __brand: 'NodeId' }

type ToNodeIdInput = number | (string & { readonly __brand?: never })

export function toNodeId(value: ToNodeIdInput): NodeId {
  return String(value) as NodeId
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
