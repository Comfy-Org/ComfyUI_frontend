// Muted palette from the workspace avatar design (Figma 6383-26840). Every
// entry is pinned to the same relative luminance, so no colour reads heavier
// than its neighbours in either theme, and all of them clear 4.5:1 against the
// white initial (WCAG AA for normal-size text).
// rust, amber, olive, teal, slate, plum, mauve, taupe,
// brick, gold, sage, steel, indigo, magenta, rosewood, graphite.
export const WORKSPACE_AVATAR_PALETTE = [
  '#A16957',
  '#8E724A',
  '#697C5F',
  '#587E79',
  '#6875A1',
  '#866E92',
  '#9A6A74',
  '#7D766B',
  '#A36666',
  '#7F784B',
  '#5E7F5E',
  '#567B95',
  '#6E74A2',
  '#A06198',
  '#9D6682',
  '#6D7883'
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
