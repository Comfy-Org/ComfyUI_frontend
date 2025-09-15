import type { InjectionKey, Ref } from 'vue'

import type { NodeProgressState } from '@/schemas/apiSchema'

/**
 * Injection key for providing selected node IDs to Vue node components.
 * Contains a reactive Set of selected node IDs (as strings).
 */
export const SelectedNodeIdsKey: InjectionKey<Ref<Set<string>>> =
  Symbol('selectedNodeIds')

/**
 * Injection key for providing executing node IDs to Vue node components.
 * Contains a reactive Set of currently executing node IDs (as strings).
 */
export const ExecutingNodeIdsKey: InjectionKey<Ref<Set<string>>> =
  Symbol('executingNodeIds')

/**
 * Injection key for providing node progress states to Vue node components.
 * Contains a reactive Record of node IDs to their current progress state.
 */
export const NodeProgressStatesKey: InjectionKey<
  Ref<Record<string, NodeProgressState>>
> = Symbol('nodeProgressStates')

/**
 * Injection key for providing node preview image URLs to Vue node components.
 * Maps NodeLocatorId (string) to an array of preview blob URLs.
 */
export const NodePreviewImagesKey: InjectionKey<Ref<Record<string, string[]>>> =
  Symbol('nodePreviewImages')
