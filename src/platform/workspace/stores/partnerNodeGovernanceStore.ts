import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
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

export type PartnerNodePolicyStatus =
  | 'inactive'
  | 'loading'
  | 'unconfigured'
  | 'configured'
  | 'ineligible'
  | 'error'

export const usePartnerNodeGovernanceStore = defineStore(
  'partnerNodeGovernance',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()

    const providers = shallowRef<PartnerProvider[]>([])
    const policy = shallowRef<PartnerNodePolicy | null>(null)
    const status = ref<PartnerNodePolicyStatus>('inactive')
    const error = shallowRef<Error | null>(null)
    const activeSaveIdsByWorkspace = shallowRef(new Map<string, number>())
    let requestVersion = 0
    let nextSaveId = 0

    const governedWorkspaceId = computed(() =>
      flags.partnerNodeGovernanceEnabled
        ? (workspaceStore.activeWorkspace?.id ?? null)
        : null
    )
    const isSaving = computed(() => {
      const workspaceId = governedWorkspaceId.value
      return (
        workspaceId !== null && activeSaveIdsByWorkspace.value.has(workspaceId)
      )
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

    async function loadPolicy(): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      const version = ++requestVersion
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
      if (activeSaveIdsByWorkspace.value.has(workspaceId)) {
        throw new Error('Provider policy save already in progress')
      }

      const version = ++requestVersion
      const saveId = ++nextSaveId
      activeSaveIdsByWorkspace.value = new Map(
        activeSaveIdsByWorkspace.value
      ).set(workspaceId, saveId)
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
        if (activeSaveIdsByWorkspace.value.get(workspaceId) === saveId) {
          const nextActiveSaveIds = new Map(activeSaveIdsByWorkspace.value)
          nextActiveSaveIds.delete(workspaceId)
          activeSaveIdsByWorkspace.value = nextActiveSaveIds
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
      isProviderEnabled,
      loadPolicy,
      setProviderEnabled,
      setAllProvidersEnabled,
      setEnforcementEnabled
    }
  }
)
