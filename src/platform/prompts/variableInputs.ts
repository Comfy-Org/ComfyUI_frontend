import type { PromptTemplate } from '@/platform/prompts/promptTypes'

/** Rewrites every `@variable` reference named `oldName` to `newName`. */
export function renameVariableInTemplate(
  template: PromptTemplate,
  oldName: string,
  newName: string
): PromptTemplate {
  return template.map((segment) =>
    segment.type === 'var' && segment.name === oldName
      ? { ...segment, name: newName }
      : segment
  )
}

/**
 * Computes how a node's variable input sockets should change to mirror the
 * declared `@variables`: drop sockets that are neither declared nor connected,
 * and add a socket for each declared variable missing one. Connected sockets are
 * always kept, even when their declaration was removed, so a live link is never
 * silently severed. Indices are relative to the supplied array; remove them in
 * descending order so earlier indices stay valid.
 */
export function planVariableSockets(
  sockets: readonly { name: string; connected: boolean }[],
  declared: readonly string[]
): { namesToAdd: string[]; indicesToRemove: number[] } {
  const wanted = new Set(declared)

  const indicesToRemove = sockets.flatMap((socket, index) =>
    !socket.connected && !(socket.name && wanted.has(socket.name))
      ? [index]
      : []
  )

  const removed = new Set(indicesToRemove)
  const survivingNames = new Set(
    sockets
      .filter((_, index) => !removed.has(index))
      .map((socket) => socket.name)
      .filter(Boolean)
  )

  const namesToAdd: string[] = []
  for (const name of declared) {
    if (!survivingNames.has(name) && !namesToAdd.includes(name)) {
      namesToAdd.push(name)
    }
  }

  return { namesToAdd, indicesToRemove }
}
