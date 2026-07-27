import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getPartnerNodePolicy,
  PartnerNodePolicyApiError
} from '@/platform/workspace/api/partnerNodePolicyApi'
import type { PartnerNodePolicy } from '@/platform/workspace/api/partnerNodePolicyApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

export interface PartnerNodeCatalogItem {
  id: string
  name: string
  provider: string
}

export type PartnerNodePolicyStatus =
  | 'inactive'
  | 'loading'
  | 'unconfigured'
  | 'configured'
  | 'unavailable'
  | 'error'

export const usePartnerNodeGovernanceStore = defineStore(
  'partnerNodeGovernance',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    const nodeDefStore = useNodeDefStore()

    const policy = shallowRef<PartnerNodePolicy | null>(null)
    const policyWorkspaceId = ref<string | null>(null)
    const status = ref<PartnerNodePolicyStatus>('inactive')
    const error = shallowRef<Error | null>(null)
    let loadVersion = 0

    const governedWorkspaceId = computed(() => {
      const workspace = workspaceStore.activeWorkspace
      return flags.teamWorkspacesEnabled &&
        flags.partnerNodeGovernanceEnabled &&
        workspace?.type === 'team'
        ? workspace.id
        : null
    })

    const partnerNodes = computed<PartnerNodeCatalogItem[]>(() =>
      Object.values(nodeDefStore.nodeDefsByName)
        .filter((nodeDef) => nodeDef.api_node)
        .map((nodeDef) => ({
          id: nodeDef.name,
          name: nodeDef.display_name || nodeDef.name,
          provider:
            nodeDef.category.split('/')[2] ||
            nodeDef.category ||
            nodeDef.python_module
        }))
    )

    function isNodeDisabled(nodeType: string): boolean {
      if (!nodeDefStore.nodeDefsByName[nodeType]?.api_node) return false
      const workspaceId = governedWorkspaceId.value
      if (!workspaceId || policyWorkspaceId.value !== workspaceId) return false
      if (status.value === 'unavailable') return true
      return (
        policy.value?.enforcementEnabled === true &&
        policy.value.nodes[nodeType] !== true
      )
    }

    async function loadPolicy(): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      const version = ++loadVersion
      if (!workspaceId) {
        policy.value = null
        policyWorkspaceId.value = null
        status.value = 'inactive'
        error.value = null
        return
      }

      const workspaceChanged = policyWorkspaceId.value !== workspaceId
      if (workspaceChanged) {
        policy.value = null
        policyWorkspaceId.value = workspaceId
        status.value = 'loading'
      } else if (status.value !== 'unavailable') {
        status.value = 'loading'
      }
      error.value = null

      try {
        const nextPolicy = await getPartnerNodePolicy()
        if (
          version !== loadVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        policy.value = nextPolicy
        status.value = nextPolicy ? 'configured' : 'unconfigured'
      } catch (loadError) {
        if (
          version !== loadVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        error.value =
          loadError instanceof Error
            ? loadError
            : new Error('Failed to load partner node policy')
        if (
          loadError instanceof PartnerNodePolicyApiError &&
          loadError.status === 503
        ) {
          policy.value = null
          status.value = 'unavailable'
          return
        }
        if (status.value !== 'unavailable') status.value = 'error'
      }
    }

    watch(governedWorkspaceId, () => void loadPolicy(), { immediate: true })

    return {
      policy,
      status,
      error,
      governedWorkspaceId,
      partnerNodes,
      isNodeDisabled,
      loadPolicy
    }
  }
)
