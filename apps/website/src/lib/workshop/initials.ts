export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Every workspace is a workspace, so the word says nothing a monogram needs:
// "Personal Workspace" is P, and "Ada Studio" is AS. A person's name is read
// whole, because there the word is part of who they are.
const TRAILING_WORKSPACE = /\s+workspace$/i

export function workspaceInitialsOf(name: string): string {
  return initialsOf(name.trim().replace(TRAILING_WORKSPACE, ''))
}
