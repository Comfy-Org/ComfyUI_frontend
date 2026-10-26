import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useExtensionStore } from '@/stores/extensionStore'

export const graphsAwaitingNodeTypes = new WeakSet<LGraph>()

/** Whether late custom node packs may still register node types, so a type missing now is not missing yet. */
export function nodeTypesMayStillArrive(): boolean {
  return useExtensionStore().areLateExtensionsPending
}
