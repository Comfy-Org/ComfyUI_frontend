import type * as Y from 'yjs'

export function write(nodes: Y.Map<Y.Map<unknown>>): void {
  for (const node of nodes.values()) node.set('mode', 4)
}
