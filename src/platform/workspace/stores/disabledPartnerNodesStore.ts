import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
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

    function isNodeDefDisabled(
      def: Pick<ComfyNodeDefImpl, 'name' | 'display_name' | 'api_node'>
    ): boolean {
      if (!def.api_node) return false
      return (
        disabledNames.value.has(def.display_name) ||
        disabledNames.value.has(def.name)
      )
    }

    // Hides disabled partner nodes from every discovery surface (node search,
    // node library) — same mechanism as the deprecated/experimental filters.
    // Canvas instances are untouched; they surface through the error panel.
    useNodeDefStore().registerNodeDefFilter({
      id: 'workspace.disabled-partner-nodes',
      name: t('nodeFilters.hideDisabledPartnerNodes'),
      predicate: (def) => !isNodeDefDisabled(def)
    })

    const disabledAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
      const ids = new Set<NodeExecutionId>()
      for (const offender of offenders.value) {
        for (const id of getAncestorExecutionIds(offender.nodeId)) {
          ids.add(id)
        }
      }
      return ids
    })

    const { flags } = useFeatureFlags()

    async function fetchDisabledNames(): Promise<void> {
      // Governance exists only for team workspaces; the guard also keeps unit
      // tests and personal accounts from ever touching the network.
      if (!isCloud || !flags.teamWorkspacesEnabled) return
      try {
        // Dynamic import keeps the auth/axios subtree out of the app's
        // startup module graph; governance is a post-load concern.
        const { partnerNodesApi } =
          await import('@/platform/workspace/api/partnerNodesApi')
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

    // The legacy right-click Add Node menu and litegraph palette read
    // skip_list off the registered types (the dev-only filter's mechanism);
    // api_node types are disjoint from dev_only so the two writers never clash.
    function syncLitegraphSkipList(): void {
      const nodeDefStore = useNodeDefStore()
      for (const def of Object.values(nodeDefStore.nodeDefsByName)) {
        if (!def.api_node) continue
        const nodeType = LiteGraph.registered_node_types[def.name]
        if (!nodeType) continue
        nodeType.skip_list = isNodeDefDisabled(def)
      }
    }

    let hookedGraph: LGraph | null = null
    let rescanTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleRescan(): void {
      if (rescanTimer) clearTimeout(rescanTimer)
      rescanTimer = setTimeout(() => {
        rescanTimer = null
        scan()
      }, 250)
    }

    // Placing or deleting nodes must re-derive offenders; the load-time scan
    // alone misses an already-disabled node added mid-session.
    function ensureGraphHooks(): void {
      const graph = app.rootGraph
      if (!graph || hookedGraph === graph) return
      hookedGraph = graph
      const prevAdded = graph.onNodeAdded
      graph.onNodeAdded = function (node) {
        prevAdded?.call(this, node)
        scheduleRescan()
      }
      const prevRemoved = graph.onNodeRemoved
      graph.onNodeRemoved = function (node) {
        prevRemoved?.call(this, node)
        scheduleRescan()
      }
    }

    function scan(): void {
      syncLitegraphSkipList()
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
      ensureGraphHooks()
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
      isNodeDefDisabled,
      surfaceDisabledNodes,
      applyGovernanceChange
    }
  }
)
