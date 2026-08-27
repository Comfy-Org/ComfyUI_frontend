import type { SerializedNodeId } from '@/types/nodeId'

export type OutputKey = string & { readonly __brand: 'OutputKey' }

export type OutputKeyParts = {
  nodeId?: SerializedNodeId | null
  subfolder?: string | null
  filename?: string | null
}

export function getOutputKey({
  nodeId,
  subfolder,
  filename
}: OutputKeyParts): OutputKey | null {
  if (nodeId == null || subfolder == null || !filename) {
    return null
  }

  return `${nodeId}-${subfolder}-${filename}` as OutputKey
}
