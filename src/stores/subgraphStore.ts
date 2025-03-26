import { LGraph } from '@comfyorg/litegraph'
import { Subgraph } from '@comfyorg/litegraph/dist/subgraphInterfaces'
import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { app } from '@/scripts/app'

import { useWorkflowStore } from './workflowStore'

const isSubgraph = (item: unknown): item is Subgraph =>
  !!item && typeof item === 'object' && 'parent' in item

const replaceUndefined = (arr: (string | null | undefined)[]) =>
  arr.map((item) => item ?? 'Unknown')

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
    const isNewRoot = !isSubgraph(activeGraph)
    if (!isNewRoot) return

    const activeWorkflowName = workflowStore.activeWorkflow?.filename
    activeRootGraphName.value = activeWorkflowName ?? 'Unsaved Workflow'
  }

  const updateGraphPaths = () => {
    const currentGraph = app?.graph
    if (!currentGraph) return

    const namePath = []
    const idPath = []

    // If it's a subgraph, traverse up the parent chain
    if (isSubgraph(currentGraph)) {
      let current: LGraph | Subgraph = currentGraph
      while (current && isSubgraph(current)) {
        idPath.unshift(current.id)
        namePath.unshift(current.name)
        current = current.parent
      }
    } else {
      // For non-subgraphs, just add the current graph's info
      idPath.push(currentGraph.id)
      namePath.push(activeRootGraphName.value)
    }

    graphIdPath.value = replaceUndefined(idPath)
    graphNamePath.value = replaceUndefined(namePath)
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
