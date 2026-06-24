export type SerializedNodeId = number | string

export type NodeId = string & { readonly __brand: 'NodeId' }

export function nodeId(value: SerializedNodeId): NodeId {
  return String(value) as NodeId
}

export function parseNodeId(value: unknown): NodeId | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? nodeId(value) : null
  }

  if (typeof value === 'string') {
    return value.length > 0 ? nodeId(value) : null
  }

  return null
}

export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value.length > 0
}
