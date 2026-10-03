import type { SerializedNodeId } from '@/types/nodeId'

export type OutputKeyParts = {
  nodeId?: SerializedNodeId | null
  subfolder?: string | null
  filename?: string | null
}

export function getOutputKey({
  nodeId,
  subfolder,
  filename
}: OutputKeyParts): string | null {
  if (nodeId == null || subfolder == null || !filename) {
    return null
  }

  return JSON.stringify([String(nodeId), subfolder, filename])
}
