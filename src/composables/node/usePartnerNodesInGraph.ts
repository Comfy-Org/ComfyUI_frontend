import {
  createSharedComposable,
  tryOnScopeDispose,
  useThrottleFn
} from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'

export interface PartnerNodeInfo {
  nodeName: string
  displayName: string
}

/**
 * Reactive list of partner nodes (node defs with `api_node: true`) in the
 * active graph, including nodes nested in subgraphs, deduped by def name.
 */
export const usePartnerNodesInGraph = createSharedComposable(() => {
  const nodeDefStore = useNodeDefStore()
  const workflowStore = useWorkflowStore()

  const graphVersion = ref(0)
  // Leading + trailing: gate state reacts to a topology change immediately, yet
  // a drag still re-scans at most twice per burst rather than every frame.
  const bumpGraphVersion = useThrottleFn(
    () => {
      graphVersion.value++
    },
    200,
    true,
    true
  )

  const onGraphChanged = () => {
    void bumpGraphVersion()
  }
  api.addEventListener('graphChanged', onGraphChanged)
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', onGraphChanged)
  })
  watch(
    () => workflowStore.activeWorkflow,
    () => {
      void bumpGraphVersion()
    }
  )

  const partnerNodes = computed<PartnerNodeInfo[]>(() => {
    // Dependency on graphVersion: re-scan when the graph mutates.
    void graphVersion.value
    if (!app.isGraphReady) return []
    const partnerNodesByName = reduceAllNodes<Map<string, PartnerNodeInfo>>(
      app.rootGraph,
      (found, node) => {
        const nodeDef = nodeDefStore.nodeDefsByName[node.type]
        if (nodeDef?.api_node) {
          found.set(nodeDef.name, {
            nodeName: nodeDef.name,
            displayName: nodeDef.display_name || nodeDef.name
          })
        }
        return found
      },
      new Map()
    )
    return [...partnerNodesByName.values()]
  })

  const hasPartnerNodes = computed(() => partnerNodes.value.length > 0)

  return { partnerNodes, hasPartnerNodes }
})
