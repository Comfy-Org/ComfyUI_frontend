import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'

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
    modelToNodeMap: {} as Record<string, ModelNodeProvider>,
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
      return this.modelToNodeMap[modelType]
    },

    /**
     * Register a node provider for the given model type name.
     * @param modelType The name of the model type to register the node provider for.
     * @param nodeProvider The node provider to register.
     */
    registerNodeProvider(modelType: string, nodeProvider: ModelNodeProvider) {
      this.registerDefaults()
      this.modelToNodeMap[modelType] = nodeProvider
    },

    registerDefaults() {
      if (this.haveDefaultsLoaded) {
        return
      }
      if (Object.keys(this.nodeDefStore.nodeDefsByName).length === 0) {
        return
      }
      this.haveDefaultsLoaded = true
      this.registerNodeProvider(
        'checkpoints',
        new ModelNodeProvider(
          this.nodeDefStore.nodeDefsByName['CheckpointLoaderSimple'],
          'ckpt_name'
        )
      )
      this.registerNodeProvider(
        'loras',
        new ModelNodeProvider(
          this.nodeDefStore.nodeDefsByName['LoraLoader'],
          'lora_name'
        )
      )
      this.registerNodeProvider(
        'vae',
        new ModelNodeProvider(
          this.nodeDefStore.nodeDefsByName['VAELoader'],
          'vae_name'
        )
      )
      this.registerNodeProvider(
        'controlnet',
        new ModelNodeProvider(
          this.nodeDefStore.nodeDefsByName['ControlNetLoader'],
          'control_net_name'
        )
      )
    }
  }
})
