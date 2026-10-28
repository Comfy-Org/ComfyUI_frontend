import type * as Y from 'yjs'

export class Collector {
  private readonly nodes: Y.Map<unknown>

  constructor(nodes: Y.Map<unknown>) {
    this.nodes = nodes
  }

  drop(): void {
    this.nodes.delete('1')
  }
}
