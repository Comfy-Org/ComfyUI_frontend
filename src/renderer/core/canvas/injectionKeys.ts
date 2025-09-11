import type { InjectionKey, Ref } from 'vue'

/**
 * Injection key for providing selected node IDs to Vue node components.
 * Contains a reactive Set of selected node IDs (as strings).
 */
export const SelectedNodeIdsKey: InjectionKey<Ref<Set<string>>> =
  Symbol('selectedNodeIds')
