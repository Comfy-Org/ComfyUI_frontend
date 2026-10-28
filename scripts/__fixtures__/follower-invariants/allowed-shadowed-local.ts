import { nodesMap } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

export function count(doc: Y.Doc): number {
  const nodes = nodesMap(doc)
  return nodes.size
}

export function collect(): string[] {
  const nodes: string[] = []
  nodes.push('1')
  return nodes
}

export function read(value: unknown): unknown {
  return value instanceof Y.Map ? value.get('1') : undefined
}

export function cache(): Map<string, number> {
  const value = new Map<string, number>()
  value.set('1', 1)
  return value
}

export const alias = Y.applyUpdate

export function notify(alias: (count: number) => void): void {
  alias(1)
}
