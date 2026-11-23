import { toError } from '@comfyorg/shared-frontend-utils/errorUtil'

const IDENTITY_POSITIONS: readonly (readonly [RegExp, string])[] = [
  [
    /^(Circular reference detected while resolving (?:input|output) \d+ of node) [\s\S]*$/,
    '$1 N'
  ],
  [/ in node [\s\S]*? of subgraph [\s\S]*$/, ' in node N of subgraph N'],
  [/\b(Subgraph)?Node \S+ has no graph/, '$1Node N has no graph'],
  [
    /^(No link found in parent graph for id \[[^\]]*\] slot \[[^\]]*\])\s+[\s\S]*$/,
    '$1'
  ],
  [/\[[^\]]*\]/g, '[]'],
  [/: \S+$/, ': N'],
  [/\d+/g, 'N']
]

/** Groups prompt build failures independently of workflow instance details. */
export function promptBuildErrorFingerprint(error: unknown): string[] {
  const { name, message } = toError(error)
  const shape = IDENTITY_POSITIONS.reduce(
    (text, [position, placeholder]) => text.replace(position, placeholder),
    message
  )
  return ['error_building_prompt', name, shape]
}
