import { debounce } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { st, t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import { forEachNode, getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { setNodeTypeHidden } from '@/utils/litegraphNodeVisibility'

export interface DisabledGraphNode {
  nodeId: NodeExecutionId
  displayName: string
}

type PolicyState = 'inactive' | 'loading' | 'verified' | 'failed'
type PolicyRefreshResult = 'success' | 'superseded' | 'failed'

/**
 * Enforcement side of partner-node governance: which allowlist-disabled
 * partner nodes are present in the open workflow. Feeds the Workflow
 * Overview error panel, canvas error flags, run gating, and the load toast.
 */
export const useDisabledPartnerNodesStore = defineStore(
  'disabledPartnerNodes',
  () => {
    const enabledNodeIds = ref<Set<string>>(new Set())
    const offenders = ref<DisabledGraphNode[]>([])
    const policyState = ref<PolicyState>('inactive')
    const policyWorkspaceId = ref<string | null>(null)
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    let refreshVersion = 0

    const governedWorkspaceId = computed(() => {
      const workspace = workspaceStore.activeWorkspace
      return flags.teamWorkspacesEnabled &&
        flags.partnerNodeGovernanceEnabled &&
        workspace?.type === 'team'
        ? workspace.id
        : null
    })

    function isNodeDefDisabled(
      def: Pick<ComfyNodeDefImpl, 'name' | 'api_node'>
    ): boolean {
      if (!def.api_node) return false
      const workspaceId = governedWorkspaceId.value
      if (!workspaceId) return false
      if (
        policyState.value !== 'verified' ||
        policyWorkspaceId.value !== workspaceId
      ) {
        return true
      }
      return !enabledNodeIds.value.has(def.name)
    }

    let nodeDefFilterRegistered = false

    function ensureNodeDefFilter(): void {
      if (nodeDefFilterRegistered) return
      useNodeDefStore().registerNodeDefFilter({
        id: 'workspace.disabled-partner-nodes',
        name: st(
          'nodeFilters.hideDisabledPartnerNodes',
          'Hide Admin-Disabled Partner Nodes'
        ),
        predicate: (def) => !isNodeDefDisabled(def)
      })
      nodeDefFilterRegistered = true
    }

    const disabledAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
      const ids = new Set<NodeExecutionId>()
      for (const offender of offenders.value) {
        for (const id of getAncestorExecutionIds(offender.nodeId)) {
          ids.add(id)
        }
      }
      return ids
    })

    async function refreshPolicy(): Promise<PolicyRefreshResult> {
      const workspaceId = governedWorkspaceId.value
      const version = ++refreshVersion
      if (!workspaceId) {
        enabledNodeIds.value = new Set()
        policyWorkspaceId.value = null
        policyState.value = 'inactive'
        return 'success'
      }
      if (policyWorkspaceId.value !== workspaceId) {
        enabledNodeIds.value = new Set()
      }
      policyState.value = 'loading'
      try {
        const { partner_nodes } = await partnerNodesApi.list()
        if (
          version !== refreshVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return 'superseded'
        }
        enabledNodeIds.value = new Set(
          partner_nodes.filter((node) => node.enabled).map((node) => node.id)
        )
        policyWorkspaceId.value = workspaceId
        policyState.value = 'verified'
        return 'success'
      } catch {
        if (
          version !== refreshVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return 'superseded'
        }
        enabledNodeIds.value = new Set()
        policyWorkspaceId.value = workspaceId
        policyState.value = 'failed'
        return 'failed'
      }
    }

    // The legacy right-click Add Node menu and litegraph palette read
    // skip_list off the registered types, so discovery filtering updates both.
    function syncLitegraphSkipList(): void {
      const nodeDefStore = useNodeDefStore()
      const devModeEnabled = useSettingStore().get('Comfy.DevMode')
      for (const def of Object.values(nodeDefStore.nodeDefsByName)) {
        if (!def.api_node) continue
        const nodeType = LiteGraph.registered_node_types[def.name]
        if (!nodeType) continue
        setNodeTypeHidden(nodeType, 'dev-only', def.dev_only && !devModeEnabled)
        setNodeTypeHidden(
          nodeType,
          'workspace-governance',
          isNodeDefDisabled(def)
        )
      }
    }

    const scheduleRescan = debounce(scanGraph, 250)

    api.addEventListener('graphChanged', scheduleRescan)
    onScopeDispose(() => {
      api.removeEventListener('graphChanged', scheduleRescan)
      scheduleRescan.cancel()
    })

    function scanGraph(): void {
      ensureNodeDefFilter()
      syncLitegraphSkipList()
      if (!app.isGraphReady) {
        offenders.value = []
        return
      }
      const nodeDefStore = useNodeDefStore()
      const found: DisabledGraphNode[] = []
      forEachNode(app.rootGraph, (node) => {
        if (!node.type) return
        const def = nodeDefStore.nodeDefsByName[node.type]
        if (!def || !isNodeDefDisabled(def)) return
        const execId = getExecutionIdByNode(app.rootGraph, node)
        if (!execId) return
        found.push({
          nodeId: execId,
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
      const refresh = refreshPolicy()
      scanGraph()
      const result = await refresh
      scanGraph()
      if (result === 'superseded') return
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
      const result = await refreshPolicy()
      if (result === 'failed') {
        throw new Error('Failed to refresh Partner Node governance policy')
      }
      if (result === 'superseded') return
      scanGraph()
    }

    watch(governedWorkspaceId, async () => {
      await surfaceDisabledNodes({ silent: true })
    })

    return {
      offenders,
      policyState,
      disabledAncestorExecutionIds,
      isNodeDefDisabled,
      scanGraph,
      surfaceDisabledNodes,
      applyGovernanceChange
    }
  }
)
