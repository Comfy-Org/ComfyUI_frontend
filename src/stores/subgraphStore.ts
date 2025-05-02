import { Subgraph } from '@comfyorg/litegraph'
import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { app as comfyApp } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

export const useSubgraphStore = defineStore('subgraph', () => {
  const workflowStore = useWorkflowStore()

  const activeGraph = shallowRef<Subgraph>()
  const graphNamePath = ref<string[]>([])
  const isSubgraphActive = ref(false)

  const updateActiveGraph = () => {
    activeGraph.value = comfyApp.canvas.subgraph
    isSubgraphActive.value = isSubgraph(activeGraph.value)
    updateGraphPaths()
  }

  const updateGraphPaths = () => {
    if (activeGraph.value) {
      const [, ...pathFromRoot] = activeGraph.value.pathToRootGraph

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
