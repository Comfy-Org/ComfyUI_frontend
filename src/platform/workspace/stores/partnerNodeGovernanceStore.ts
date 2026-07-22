import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getPartnerNodePolicy,
  getPartnerProviders,
  PartnerNodePolicyApiError
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
    let requestVersion = 0

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

    watch(governedWorkspaceId, () => void loadPolicy(), { immediate: true })

    return {
      providers,
      policy,
      status,
      error,
      governedWorkspaceId,
      createInitialPolicy,
      isProviderEnabled,
      loadPolicy
    }
  }
)
