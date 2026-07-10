import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import { forEachNode, getExecutionIdByNode } from '@/utils/graphTraversalUtil'

export interface DisabledGraphNode {
  nodeId: NodeExecutionId
  graphNodeId: string
  displayName: string
}

/**
 * Enforcement side of partner-node governance: which allowlist-disabled
 * partner nodes are present in the open workflow. Feeds the Workflow
 * Overview error panel, canvas error flags, run gating, and the load toast.
 */
export const useDisabledPartnerNodesStore = defineStore(
  'disabledPartnerNodes',
  () => {
    const disabledNames = ref<Set<string>>(new Set())
    const offenders = ref<DisabledGraphNode[]>([])

    const disabledAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
      const ids = new Set<NodeExecutionId>()
      for (const offender of offenders.value) {
        for (const id of getAncestorExecutionIds(offender.nodeId)) {
          ids.add(id)
        }
      }
      return ids
    })

    async function fetchDisabledNames(): Promise<void> {
      if (!isCloud) return
      try {
        const { partner_nodes } = await partnerNodesApi.list()
        disabledNames.value = new Set(
          partner_nodes.filter((n) => !n.enabled).map((n) => n.name)
        )
      } catch {
        // Governance unavailable (no team workspace / endpoint missing):
        // enforce nothing rather than fail the workflow load.
        disabledNames.value = new Set()
      }
    }

    function scan(): void {
      if (!app.isGraphReady || disabledNames.value.size === 0) {
        offenders.value = []
        return
      }
      const nodeDefStore = useNodeDefStore()
      const found: DisabledGraphNode[] = []
      forEachNode(app.rootGraph, (node) => {
        if (!node.type) return
        const def = nodeDefStore.nodeDefsByName[node.type]
        if (!def?.api_node) return
        const disabled =
          disabledNames.value.has(def.display_name) ||
          disabledNames.value.has(def.name)
        if (!disabled) return
        const execId = getExecutionIdByNode(app.rootGraph, node)
        if (!execId) return
        found.push({
          nodeId: execId,
          graphNodeId: String(node.id),
          displayName: def.display_name || def.name
        })
      })
      offenders.value = found.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      )
    }

    /** Workflow-load entry point: refresh governance, scan, announce. */
    async function surfaceDisabledNodes(
      options: { silent?: boolean } = {}
    ): Promise<void> {
      await fetchDisabledNames()
      scan()
      if (options.silent || offenders.value.length === 0) return
      useToastStore().add({
        severity: 'error',
        group: 'disabled-nodes',
        summary: t(
          'rightSidePanel.disabledNodes.title',
          offenders.value.length
        ),
        detail: t(
          'rightSidePanel.disabledNodes.toastDetail',
          offenders.value.length
        ),
        life: 10000
      })
    }

    /** Settings-panel toggles call this so an open workflow updates live. */
    async function applyGovernanceChange(): Promise<void> {
      await fetchDisabledNames()
      scan()
    }

    return {
      offenders,
      disabledAncestorExecutionIds,
      surfaceDisabledNodes,
      applyGovernanceChange
    }
  }
)
