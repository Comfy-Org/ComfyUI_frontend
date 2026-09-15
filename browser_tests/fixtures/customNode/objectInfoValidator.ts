interface ObjectInfoNode {
  input?: { required?: Record<string, unknown> }
}
export type ObjectInfo = Record<string, ObjectInfoNode>

// Names from `expectedNodes` absent from the backend's object_info. Empty
// result = every expected node is registered on this backend.
export function missingExpectedNodes(
  objectInfo: ObjectInfo,
  expectedNodes: string[]
): string[] {
  return expectedNodes.filter((name) => !(name in objectInfo))
}
