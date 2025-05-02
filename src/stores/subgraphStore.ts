import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { app as comfyApp } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

export const useSubgraphStore = defineStore('subgraph', () => {
  const workflowStore = useWorkflowStore()

  const graphNamePath = ref<string[]>([])
  const isSubgraphActive = ref(false)

  const updateActiveGraph = () => {
    const { subgraph } = comfyApp.canvas
    isSubgraphActive.value = isSubgraph(subgraph)

    if (subgraph) {
      const [, ...pathFromRoot] = subgraph.pathToRootGraph

      graphNamePath.value = pathFromRoot.map((graph) => graph.name)
    } else {
      graphNamePath.value = []
    }
  }

  whenever(() => workflowStore.activeWorkflow, updateActiveGraph, {
    immediate: true
  })

  return {
    graphNamePath,
    isSubgraphActive,

    updateActiveGraph
  }
})
