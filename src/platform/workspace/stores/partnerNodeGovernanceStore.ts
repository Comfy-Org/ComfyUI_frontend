import { defineStore } from 'pinia'
import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  watchEffect
} from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  getPartnerNodePolicy,
  PartnerNodePolicyApiError,
  updatePartnerNodePolicy
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

const DISCOVERY_FILTER_ID = 'workspace.partner-node-governance'

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
    let workspaceVersion = 0
    let loadPromise: Promise<void> | null = null
    let loadPromiseWorkspaceId: string | null = null

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

    nodeDefStore.registerNodeDefFilter({
      id: DISCOVERY_FILTER_ID,
      name: t('nodeFilters.workspacePartnerNodeGovernance'),
      predicate: (nodeDef) => !isNodeDisabled(nodeDef.name)
    })

    const legacyHiddenNodeTypes = new Set<string>()
    watchEffect(() => {
      const showDevOnly = nodeDefStore.showDevOnly
      for (const nodeDef of Object.values(nodeDefStore.nodeDefsByName)) {
        if (!nodeDef.api_node) continue
        const nodeType = LiteGraph.registered_node_types[nodeDef.name]
        if (!nodeType) continue

        if (isNodeDisabled(nodeDef.name)) {
          if (!nodeType.skip_list) {
            nodeType.skip_list = true
            legacyHiddenNodeTypes.add(nodeDef.name)
          }
          continue
        }

        if (legacyHiddenNodeTypes.delete(nodeDef.name)) {
          nodeType.skip_list = nodeDef.dev_only && !showDevOnly
        }
      }
    })

    onScopeDispose(() => {
      nodeDefStore.unregisterNodeDefFilter(DISCOVERY_FILTER_ID)
      for (const nodeName of legacyHiddenNodeTypes) {
        const nodeDef = nodeDefStore.nodeDefsByName[nodeName]
        const nodeType = LiteGraph.registered_node_types[nodeName]
        if (nodeDef && nodeType) {
          nodeType.skip_list = nodeDef.dev_only && !nodeDefStore.showDevOnly
        }
      }
    })

    async function performLoadPolicy(): Promise<void> {
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

    function loadPolicy(): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      if (loadPromise && loadPromiseWorkspaceId === workspaceId) {
        return loadPromise
      }

      const currentLoad = performLoadPolicy()
      loadPromise = currentLoad
      loadPromiseWorkspaceId = workspaceId
      void currentLoad.finally(() => {
        if (loadPromise === currentLoad) {
          loadPromise = null
          loadPromiseWorkspaceId = null
        }
      })
      return currentLoad
    }

    async function savePolicy(nextPolicy: PartnerNodePolicy): Promise<boolean> {
      const workspaceId = governedWorkspaceId.value
      const version = workspaceVersion
      if (!workspaceId || policyWorkspaceId.value !== workspaceId) {
        throw new Error('Partner node governance is not ready')
      }

      let savedPolicy: PartnerNodePolicy
      try {
        savedPolicy = await updatePartnerNodePolicy(nextPolicy)
      } catch (saveError) {
        if (
          workspaceVersion !== version ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return false
        }
        throw saveError
      }
      if (
        workspaceVersion !== version ||
        governedWorkspaceId.value !== workspaceId
      ) {
        return false
      }

      policy.value = savedPolicy
      policyWorkspaceId.value = workspaceId
      status.value = 'configured'
      error.value = null
      return true
    }

    watch(
      governedWorkspaceId,
      () => {
        workspaceVersion++
        void loadPolicy()
      },
      { immediate: true, flush: 'sync' }
    )

    return {
      policy,
      status,
      error,
      governedWorkspaceId,
      partnerNodes,
      isNodeDisabled,
      loadPolicy,
      savePolicy
    }
  }
)
