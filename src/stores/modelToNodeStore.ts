import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { defineStore } from 'pinia'

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
export const useModelToNodeStore = defineStore('modelToNode', {
  state: () => ({
    modelToNodeMap: {} as Record<string, ModelNodeProvider[]>,
    nodeDefStore: useNodeDefStore(),
    haveDefaultsLoaded: false
  }),
  actions: {
    /**
     * Get the node provider for the given model type name.
     * @param modelType The name of the model type to get the node provider for.
     * @returns The node provider for the given model type name.
     */
    getNodeProvider(modelType: string): ModelNodeProvider {
      this.registerDefaults()
      return this.modelToNodeMap[modelType]?.[0]
    },

    /**
     * Get the list of all valid node providers for the given model type name.
     * @param modelType The name of the model type to get the node providers for.
     * @returns The list of all valid node providers for the given model type name.
     */
    getAllNodeProviders(modelType: string): ModelNodeProvider[] {
      this.registerDefaults()
      return this.modelToNodeMap[modelType]
    },

    /**
     * Register a node provider for the given model type name.
     * @param modelType The name of the model type to register the node provider for.
     * @param nodeProvider The node provider to register.
     */
    registerNodeProvider(modelType: string, nodeProvider: ModelNodeProvider) {
      this.registerDefaults()
      this.modelToNodeMap[modelType] ??= []
      this.modelToNodeMap[modelType].push(nodeProvider)
    },

    /**
     * Register a node provider for the given simple names.
     * @param modelType The name of the model type to register the node provider for.
     * @param nodeClass The node class name to register.
     * @param key The key to use for the node input.
     */
    quickRegister(modelType: string, nodeClass: string, key: string) {
      this.registerNodeProvider(
        modelType,
        new ModelNodeProvider(this.nodeDefStore.nodeDefsByName[nodeClass], key)
      )
    },

    registerDefaults() {
      if (this.haveDefaultsLoaded) {
        return
      }
      if (Object.keys(this.nodeDefStore.nodeDefsByName).length === 0) {
        return
      }
      this.haveDefaultsLoaded = true
      this.quickRegister('checkpoints', 'CheckpointLoaderSimple', 'ckpt_name')
      this.quickRegister('loras', 'LoraLoader', 'lora_name')
      this.quickRegister('vae', 'VAELoader', 'vae_name')
      this.quickRegister('controlnet', 'ControlNetLoader', 'control_net_name')
    }
  }
})
