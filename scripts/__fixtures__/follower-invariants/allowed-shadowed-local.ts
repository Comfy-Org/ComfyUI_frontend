import { nodesMap } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

export function count(doc: Y.Doc): number {
  const nodes = nodesMap(doc)
  return nodes.size
}

export function collect(): string[] {
  const nodes: string[] = []
  nodes.push('1')
  return nodes
}
