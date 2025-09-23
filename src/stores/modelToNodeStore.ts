import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/** Helper class that defines how to construct a node from a model. */
export class ModelNodeProvider {
  /** The node definition to use for this model. */
  public nodeDef: ComfyNodeDefImpl

  /** The node input key for where to inside the model name. */
  public key: string

  constructor(nodeDef: ComfyNodeDefImpl, key: string) {
    this.nodeDef = nodeDef
    this.key = key
  }
}

/** Service for mapping model types (by folder name) to nodes. */
export const useModelToNodeStore = defineStore('modelToNode', () => {
  const modelToNodeMap = ref<Record<string, ModelNodeProvider[]>>({})
  const nodeDefStore = useNodeDefStore()
  const haveDefaultsLoaded = ref(false)

  /** Internal computed for reactive caching of registered node types */
  const registeredNodeTypes = computed(() => {
    return new Set(
      Object.values(modelToNodeMap.value)
        .flat()
        .map((provider) => provider.nodeDef.name)
    )
  })

  /** Internal computed for efficient reverse lookup: nodeType -> category */
  const nodeTypeToCategory = computed(() => {
    const lookup: Record<string, string> = {}
    for (const [category, providers] of Object.entries(modelToNodeMap.value)) {
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
  function getRegisteredNodeTypes(): Set<string> {
    registerDefaults()
    return registeredNodeTypes.value
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
   * Get the node provider for the given model type name.
   * @param modelType The name of the model type to get the node provider for.
   * @returns The node provider for the given model type name.
   */
  function getNodeProvider(modelType: string): ModelNodeProvider | undefined {
    registerDefaults()
    return modelToNodeMap.value[modelType]?.[0]
  }
  /**
   * Get the list of all valid node providers for the given model type name.
   * @param modelType The name of the model type to get the node providers for.
   * @returns The list of all valid node providers for the given model type name.
   */
  function getAllNodeProviders(modelType: string): ModelNodeProvider[] {
    registerDefaults()
    return modelToNodeMap.value[modelType] ?? []
  }
  /**
   * Register a node provider for the given model type name.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeProvider The node provider to register.
   */
  function registerNodeProvider(
    modelType: string,
    nodeProvider: ModelNodeProvider
  ) {
    registerDefaults()
    if (!modelToNodeMap.value[modelType]) {
      modelToNodeMap.value[modelType] = []
    }
    modelToNodeMap.value[modelType].push(nodeProvider)
  }
  /**
   * Register a node provider for the given simple names.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeClass The node class name to register.
   * @param key The key to use for the node input.
   */
  function quickRegister(modelType: string, nodeClass: string, key: string) {
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

    quickRegister('checkpoints', 'CheckpointLoaderSimple', 'ckpt_name')
    quickRegister('checkpoints', 'ImageOnlyCheckpointLoader', 'ckpt_name')
    quickRegister('loras', 'LoraLoader', 'lora_name')
    quickRegister('loras', 'LoraLoaderModelOnly', 'lora_name')
    quickRegister('vae', 'VAELoader', 'vae_name')
    quickRegister('controlnet', 'ControlNetLoader', 'control_net_name')
    quickRegister('unet', 'UNETLoader', 'unet_name')
    quickRegister('upscale_models', 'UpscaleModelLoader', 'model_name')
    quickRegister('style_models', 'StyleModelLoader', 'style_model')
    quickRegister('gligen', 'GLIGENLoader', 'gligen_name')
  }

  return {
    modelToNodeMap,
    getRegisteredNodeTypes,
    getCategoryForNodeType,
    getNodeProvider,
    getAllNodeProviders,
    registerNodeProvider,
    quickRegister,
    registerDefaults
  }
})
