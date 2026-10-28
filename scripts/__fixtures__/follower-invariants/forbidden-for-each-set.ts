import type * as Y from 'yjs'

export function write(nodes: Y.Map<Y.Map<unknown>>): void {
  nodes.forEach((node) => node.set('mode', 4))
}
