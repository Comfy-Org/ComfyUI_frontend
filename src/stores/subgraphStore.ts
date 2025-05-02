import { LGraph } from '@comfyorg/litegraph'
import { Subgraph } from '@comfyorg/litegraph'
import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { app as comfyApp } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

const UNSAVED_WORKFLOW_NAME = 'Unsaved Workflow'

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
    const currentGraph = comfyApp.canvas.graph
    if (!currentGraph) {
      graphNamePath.value = []
      return
    }

    const { activeWorkflow } = workflowStore
    const namePath: string[] = []

    let cur: LGraph | Subgraph | undefined = currentGraph
    while (cur) {
      const name = isSubgraph(cur)
        ? cur.name
        : activeWorkflow?.filename ?? UNSAVED_WORKFLOW_NAME

      namePath.unshift(name)
      cur = isSubgraph(cur) ? cur.parents.at(-1) : undefined
    }

    graphNamePath.value = namePath
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
