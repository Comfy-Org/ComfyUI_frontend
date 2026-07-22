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
  getPartnerProviders,
  PartnerNodePolicyApiError,
  updatePartnerNodePolicy
} from '@/platform/workspace/api/partnerNodePolicyApi'
import type {
  PartnerNodePolicy,
  PartnerProvider
} from '@/platform/workspace/api/partnerNodePolicyApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getProviderName } from '@/utils/categoryUtil'

export type PartnerNodePolicyStatus =
  | 'inactive'
  | 'loading'
  | 'unconfigured'
  | 'configured'
  | 'ineligible'
  | 'error'

const DISCOVERY_FILTER_ID = 'workspace.partner-node-governance'

export const usePartnerNodeGovernanceStore = defineStore(
  'partnerNodeGovernance',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    const nodeDefStore = useNodeDefStore()

    const providers = shallowRef<PartnerProvider[]>([])
    const policy = shallowRef<PartnerNodePolicy | null>(null)
    const status = ref<PartnerNodePolicyStatus>('inactive')
    const error = shallowRef<Error | null>(null)
    const isSaving = ref(false)
    let requestVersion = 0
    let nextSaveId = 0
    let activeSave: { id: number; workspaceId: string } | null = null

    const governedWorkspaceId = computed(() => {
      const workspace = workspaceStore.activeWorkspace
      return flags.teamWorkspacesEnabled &&
        flags.partnerNodeGovernanceEnabled &&
        workspace?.type === 'team'
        ? workspace.id
        : null
    })

    function createInitialPolicy(): PartnerNodePolicy {
      return {
        enforcementEnabled: false,
        providers: providers.value.map(({ id }) => ({
          providerId: id,
          enabled: true
        }))
      }
    }

    function isProviderEnabled(providerId: string): boolean {
      if (!policy.value) return true
      return (
        policy.value.providers.find(
          (provider) => provider.providerId === providerId
        )?.enabled === true
      )
    }

    function getNodeProviderId(nodeType: string): string | null {
      const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
      if (!nodeDef?.api_node) return null

      const nodeCategory = getProviderName(nodeDef.category)
      return (
        providers.value.find(({ nodeCategories }) =>
          nodeCategories.includes(nodeCategory)
        )?.id ?? null
      )
    }

    function isNodeDisabled(nodeType: string): boolean {
      if (policy.value?.enforcementEnabled !== true) return false

      const providerId = getNodeProviderId(nodeType)
      return providerId !== null && !isProviderEnabled(providerId)
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

    async function loadPolicy(): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      const version = ++requestVersion
      if (activeSave?.workspaceId !== workspaceId) {
        activeSave = null
        isSaving.value = false
      }
      if (!workspaceId) {
        providers.value = []
        policy.value = null
        status.value = 'inactive'
        error.value = null
        return
      }

      providers.value = []
      policy.value = null
      status.value = 'loading'
      error.value = null

      try {
        const [nextProviders, nextPolicy] = await Promise.all([
          getPartnerProviders(),
          getPartnerNodePolicy()
        ])
        if (
          version !== requestVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        providers.value = nextProviders
        policy.value = nextPolicy
        status.value = nextPolicy ? 'configured' : 'unconfigured'
      } catch (loadError) {
        if (
          version !== requestVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        providers.value = []
        policy.value = null
        error.value =
          loadError instanceof Error
            ? loadError
            : new Error('Failed to load partner provider policy')
        status.value =
          loadError instanceof PartnerNodePolicyApiError &&
          loadError.status === 403
            ? 'ineligible'
            : 'error'
      }
    }

    async function savePolicy(nextPolicy: PartnerNodePolicy): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      if (!workspaceId) return
      if (isSaving.value) {
        throw new Error('Provider policy save already in progress')
      }

      const version = ++requestVersion
      const saveId = ++nextSaveId
      activeSave = { id: saveId, workspaceId }
      isSaving.value = true
      try {
        const savedPolicy = await updatePartnerNodePolicy(nextPolicy)
        if (
          version !== requestVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }

        policy.value = savedPolicy
        status.value = 'configured'
        error.value = null
      } catch (saveError) {
        if (
          version !== requestVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        if (
          saveError instanceof PartnerNodePolicyApiError &&
          saveError.status === 422
        ) {
          await loadPolicy()
        }
        throw saveError
      } finally {
        if (activeSave?.id === saveId) {
          activeSave = null
          isSaving.value = false
        }
      }
    }

    async function setProviderEnabled(
      providerId: string,
      enabled: boolean
    ): Promise<void> {
      if (!providers.value.some(({ id }) => id === providerId)) return

      const currentPolicy = policy.value ?? createInitialPolicy()
      const currentEntry = currentPolicy.providers.find(
        (provider) => provider.providerId === providerId
      )
      const nextProviders = currentEntry
        ? currentPolicy.providers.map((provider) =>
            provider.providerId === providerId
              ? { ...provider, enabled }
              : provider
          )
        : [...currentPolicy.providers, { providerId, enabled }]

      await savePolicy({
        ...currentPolicy,
        enforcementEnabled: currentPolicy.enforcementEnabled || !enabled,
        providers: nextProviders
      })
    }

    async function setAllProvidersEnabled(enabled: boolean): Promise<void> {
      const currentPolicy = policy.value ?? createInitialPolicy()
      await savePolicy({
        ...currentPolicy,
        enforcementEnabled: currentPolicy.enforcementEnabled || !enabled,
        providers: providers.value.map(({ id }) => ({
          providerId: id,
          enabled
        }))
      })
    }

    async function setEnforcementEnabled(enabled: boolean): Promise<void> {
      const currentPolicy = policy.value ?? createInitialPolicy()
      await savePolicy({
        ...currentPolicy,
        enforcementEnabled: enabled,
        providers: enabled
          ? currentPolicy.providers
          : providers.value.map(({ id }) => ({ providerId: id, enabled: true }))
      })
    }

    watch(governedWorkspaceId, () => void loadPolicy(), { immediate: true })

    return {
      providers,
      policy,
      status,
      error,
      isSaving,
      governedWorkspaceId,
      createInitialPolicy,
      isProviderEnabled,
      getNodeProviderId,
      isNodeDisabled,
      loadPolicy,
      savePolicy,
      setProviderEnabled,
      setAllProvidersEnabled,
      setEnforcementEnabled
    }
  }
)
