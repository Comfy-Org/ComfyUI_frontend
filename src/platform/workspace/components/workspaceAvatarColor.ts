// Muted palette from the workspace avatar design (Figma 6383-26840):
// rust, amber, olive, teal, slate, plum, mauve, taupe,
// brick, gold, sage, steel, indigo, magenta, rosewood, graphite.
export const WORKSPACE_AVATAR_PALETTE = [
  '#A97260',
  '#987A4F',
  '#708566',
  '#5F8782',
  '#717EA7',
  '#8E7799',
  '#A0737D',
  '#867E73',
  '#A97070',
  '#888050',
  '#658865',
  '#5C84A0',
  '#777CA8',
  '#A66C9F',
  '#A3708A',
  '#75808C'
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
