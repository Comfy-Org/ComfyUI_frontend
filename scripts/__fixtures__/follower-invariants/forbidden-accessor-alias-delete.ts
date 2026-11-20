import { nodesMap } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

export function write(doc: Y.Doc): void {
  const nodes = nodesMap(doc)
  nodes.delete('1')
}
