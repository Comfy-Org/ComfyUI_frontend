import { LGraph } from '@comfyorg/litegraph'
import { Subgraph } from '@comfyorg/litegraph/dist/subgraphInterfaces'
import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

export const useSubgraphStore = defineStore('subgraph', () => {
  const workflowStore = useWorkflowStore()

  const activeGraph = shallowRef<Subgraph | LGraph | null>(null)
  const activeRootGraphName = ref<string | null>(null)

  const graphIdPath = ref<LGraph['id'][]>([])
  const graphNamePath = ref<string[]>([])

  const isSubgraphActive = computed(
    () => activeGraph.value !== null && isSubgraph(activeGraph.value)
  )

  const updateActiveGraph = () => {
    activeGraph.value = app?.graph
  }

  const updateRootGraphName = () => {
    const isNewRoot = !isSubgraph(activeGraph.value)
    if (!isNewRoot) return

    const activeWorkflowName = workflowStore.activeWorkflow?.filename
    activeRootGraphName.value = activeWorkflowName ?? 'Unsaved Workflow'
  }

  const updateGraphPaths = () => {
    const currentGraph = app?.graph
    if (!currentGraph) {
      graphIdPath.value = []
      graphNamePath.value = []
      return
    }

    const { activeWorkflow } = workflowStore

    const namePath: string[] = []
    const idPath: LGraph['id'][] = []

    let cur: LGraph | Subgraph | null = currentGraph
    while (cur) {
      const name = isSubgraph(cur)
        ? cur.name
        : activeWorkflow?.filename ?? 'Unsaved Workflow'

      namePath.unshift(name)
      idPath.unshift(cur.id)

      cur = isSubgraph(cur) ? cur.parent : null
    }

    graphIdPath.value = idPath
    graphNamePath.value = namePath
  }

  whenever(() => app?.graph, updateActiveGraph, {
    immediate: true,
    once: true
  })
  whenever(() => workflowStore.activeWorkflow, updateActiveGraph)
  whenever(activeGraph, () => {
    updateRootGraphName()
    updateGraphPaths()
  })

  return {
    graphIdPath,
    graphNamePath,
    isSubgraphActive,

    updateActiveGraph
  }
})
