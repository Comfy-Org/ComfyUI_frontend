import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

type ExecutionStatusKey =
  | 'generating'
  | 'saving'
  | 'loading'
  | 'encoding'
  | 'decoding'
  | 'processing'
  | 'resizing'
  | 'generatingVideo'
  | 'processingVideo'
  | 'training'

/**
 * Specific status messages for nodes that can't be matched by PascalCase
 * identifier patterns (e.g. unconventional naming, spaces).
 */
const statusMap: Record<string, ExecutionStatusKey> = {
  // Video utility nodes with non-standard naming
  'Video Slice': 'processingVideo',
  GetVideoComponents: 'processingVideo',
  CreateVideo: 'processingVideo',

  // Training
  TrainLoraNode: 'training'
}

/**
 * Matches a PascalCase identifier within a node type name.
 */
function pascalId(...ids: string[]): RegExp {
  return new RegExp('(?:' + ids.join('|') + ')(?![a-z])')
}

const identifierRules: [RegExp, ExecutionStatusKey][] = [
  [pascalId('Save', 'Preview'), 'saving'],
  [pascalId('Load', 'Loader'), 'loading'],
  [pascalId('Encode'), 'encoding'],
  [pascalId('Decode'), 'decoding'],
  [pascalId('Compile', 'Conditioning', 'Merge'), 'processing'],
  [pascalId('Upscale', 'Resize'), 'resizing'],
  [pascalId('ToVideo'), 'generatingVideo'],
  [pascalId('Sampler'), 'generating']
]

export function getExecutionStatusMessage(
  t: (key: string) => string,
  nodeType: string,
  nodeDef?: ComfyNodeDefImpl | null,
  properties?: Record<string, unknown>
): string | null {
  const customMessage = properties?.['Execution Message']
  if (typeof customMessage === 'string' && customMessage.trim()) {
    return customMessage.trim()
  }

  if (nodeType in statusMap) return t(`execution.${statusMap[nodeType]}`)

  for (const [pattern, key] of identifierRules) {
    if (pattern.test(nodeType)) return t(`execution.${key}`)
  }

  if (nodeDef?.api_node) return t('execution.processing')

  return null
}
