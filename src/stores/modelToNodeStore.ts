import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MODEL_NODE_MAPPINGS } from '@/platform/assets/mappings/modelNodeMappings'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { matchesWidgetName } from '@/utils/widgetBinding'

/** Helper class that defines how to construct a node from a model. */
export class ModelNodeProvider {
  /** The node definition to use for this model. */
  public nodeDef: ComfyNodeDefImpl

  /** The input name or pattern used to select the model widget. */
  public key: string | RegExp

  constructor(nodeDef: ComfyNodeDefImpl, key: string | RegExp) {
    this.nodeDef = nodeDef
    this.key = key
  }
}

/** Service for mapping model types (by folder name) to nodes. */
export const useModelToNodeStore = defineStore('modelToNode', () => {
  const modelToNodeMap = ref<Partial<Record<string, ModelNodeProvider[]>>>({})
  const nodeDefStore = useNodeDefStore()
  const haveDefaultsLoaded = ref(false)

  const registeredNodeTypes = computed<
    Partial<Record<string, string | RegExp>>
  >(() =>
    Object.fromEntries(
      Object.values(modelToNodeMap.value)
        .filter((providers) => providers !== undefined)
        .flat()
        .map((provider) => [provider.nodeDef.name, provider.key])
    )
  )

  /** Internal computed for efficient reverse lookup: nodeType -> category */
  const nodeTypeToCategory = computed(() => {
    const lookup: Record<string, string> = {}
    for (const [category, providers] of Object.entries(modelToNodeMap.value)) {
      if (!providers) continue
      for (const provider of providers) {
        // Only store the first category for each node type (matches current assetService behavior)
        if (!lookup[provider.nodeDef.name]) {
          lookup[provider.nodeDef.name] = category
        }
      }
    }
    return lookup
  })

  /** Get set of all registered node types for efficient lookup */
  function getRegisteredNodeTypes(): Partial<Record<string, string | RegExp>> {
    registerDefaults()
    return registeredNodeTypes.value
  }

  function isModelWidget(nodeType: string, widgetName: string): boolean {
    const key = getRegisteredNodeTypes()[nodeType]
    return key !== undefined && matchesWidgetName(widgetName, key)
  }

  /**
   * Get the category for a given node type.
   * Performs efficient O(1) lookup using cached reverse map.
   * @param nodeType The node type name to find the category for
   * @returns The category name, or undefined if not found
   */
  function getCategoryForNodeType(nodeType: string): string | undefined {
    registerDefaults()

    // Handle invalid input gracefully
    if (!nodeType || typeof nodeType !== 'string') {
      return undefined
    }

    return nodeTypeToCategory.value[nodeType]
  }

  /**
   * Find providers for modelType with hierarchical fallback.
   * Tries exact match first, then progressively shorter parent paths.
   * e.g., "a/b/c" tries "a/b/c" → "a/b" → "a".
   */
  function findProvidersWithFallback(
    modelType: string
  ): ModelNodeProvider[] | undefined {
    if (!modelType || typeof modelType !== 'string') {
      return undefined
    }

    const segments = modelType.split('/')
    for (let i = segments.length; i >= 1; i--) {
      const path = segments.slice(0, i).join('/')
      const providers = modelToNodeMap.value[path]
      if (providers && providers.length > 0) return providers
    }

    return undefined
  }

  /**
   * Get the node provider for the given model type name.
   * Supports hierarchical lookups: if "parent/child" has no match, falls back to "parent".
   * @param modelType The name of the model type to get the node provider for.
   * @returns The node provider for the given model type name.
   */
  function getNodeProvider(modelType: unknown): ModelNodeProvider | undefined {
    if (typeof modelType !== 'string') return undefined
    registerDefaults()
    return findProvidersWithFallback(modelType)?.[0]
  }

  /**
   * Get the list of all valid node providers for the given model type name.
   * Supports hierarchical lookups: if "parent/child" has no match, falls back to "parent".
   * @param modelType The name of the model type to get the node providers for.
   * @returns The list of all valid node providers for the given model type name.
   */
  function getAllNodeProviders(modelType: unknown): ModelNodeProvider[] {
    if (typeof modelType !== 'string') return []
    registerDefaults()
    return findProvidersWithFallback(modelType) ?? []
  }
  /**
   * Register a node provider for the given model type name.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeProvider The node provider to register.
   */
  function registerNodeProvider(
    modelType: string,
    nodeProvider:
      | ModelNodeProvider
      | { nodeDef: undefined; key: string | RegExp }
  ) {
    registerDefaults()
    if (!nodeProvider.nodeDef) return
    const providers = (modelToNodeMap.value[modelType] ??= [])
    providers.push(nodeProvider)
  }
  /**
   * Register a node provider for the given simple names.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeClass The node class name to register.
   * @param key The key to use for the node input.
   */
  function quickRegister(
    modelType: string,
    nodeClass: string,
    key: string | RegExp
  ) {
    registerNodeProvider(
      modelType,
      new ModelNodeProvider(nodeDefStore.nodeDefsByName[nodeClass], key)
    )
  }

  function registerDefaults() {
    if (haveDefaultsLoaded.value) {
      return
    }
    if (Object.keys(nodeDefStore.nodeDefsByName).length === 0) {
      return
    }
    haveDefaultsLoaded.value = true

    for (const [modelType, nodeClass, key] of MODEL_NODE_MAPPINGS) {
      quickRegister(modelType, nodeClass, key)
    }
  }

  return {
    modelToNodeMap,
    getRegisteredNodeTypes,
    isModelWidget,
    getCategoryForNodeType,
    getNodeProvider,
    getAllNodeProviders,
    registerNodeProvider,
    quickRegister,
    registerDefaults
  }
})
