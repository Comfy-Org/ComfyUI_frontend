// Every workspace is a workspace, so the word says nothing a monogram needs:
// "Personal Workspace" is P, and "Ada Studio" is AS.
const TRAILING_WORKSPACE = /\s+workspace$/i

export function initialsOf(name: string): string {
  return name
    .trim()
    .replace(TRAILING_WORKSPACE, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
