/**
 * Mirrors the manager's identifierFor: the node class (and node id) that a
 * display name scaffolds into. Kept in sync so the client can predict the
 * node id of a node it just created — for example to drop it onto the graph
 * after the pack is submitted.
 */
export function nodeClassNameFor(name: string): string {
  const parts = name.match(/[A-Za-z0-9]+/g) ?? []
  const identifier = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  if (identifier === '') return 'Custom'
  return /^[A-Za-z]/.test(identifier) ? identifier : `Node${identifier}`
}

/** Pack and node names accepted by the manager. */
export const CUSTOM_NODE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,79}$/

export function isValidCustomNodeName(name: string): boolean {
  return CUSTOM_NODE_NAME_PATTERN.test(name.trim())
}
