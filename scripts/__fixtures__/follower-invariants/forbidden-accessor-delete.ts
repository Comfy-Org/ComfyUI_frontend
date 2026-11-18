import { nodesMap } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

export function write(doc: Y.Doc): void {
  nodesMap(doc).delete('1')
}
