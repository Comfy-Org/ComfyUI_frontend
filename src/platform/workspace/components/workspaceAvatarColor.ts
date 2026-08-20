// Muted palette from the workspace avatar design (Figma 6383-26840):
// rust, amber, olive, teal, slate, plum, mauve, taupe,
// brick, gold, sage, steel, indigo, magenta, rosewood, graphite.
export const WORKSPACE_AVATAR_PALETTE = [
  '#A06856',
  '#97794E',
  '#5A6B52',
  '#4E6E6A',
  '#4A5578',
  '#6E5A78',
  '#9A6A74',
  '#6B655C',
  '#8F5656',
  '#837B4D',
  '#5C7C5C',
  '#4D6E86',
  '#5A5F8C',
  '#8C5586',
  '#8C5A73',
  '#66707A'
] as const

export function workspaceAvatarColor(
  workspaceName: string | null | undefined
): string {
  let hash = 0
  for (const char of workspaceName ?? '') {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0
  }
  return WORKSPACE_AVATAR_PALETTE[
    Math.abs(hash) % WORKSPACE_AVATAR_PALETTE.length
  ]
}
