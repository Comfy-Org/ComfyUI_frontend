import { useExtensionStore } from '@/stores/extensionStore'

/** Whether late custom node packs may still register node types, so a type missing now is not missing yet. */
export function nodeTypesMayStillArrive(): boolean {
  return useExtensionStore().areLateExtensionsPending
}
