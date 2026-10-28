import { useCustomNodeStore } from '@/platform/customNodes/stores/customNodeStore'

/** Whether late custom node packs may still register node types, so a type missing now is not missing yet. */
export function nodeTypesMayStillArrive(): boolean {
  return useCustomNodeStore().areLateCustomNodesPending
}
