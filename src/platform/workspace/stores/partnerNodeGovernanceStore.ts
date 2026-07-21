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
  PartnerProvider,
  PartnerProviderPolicy
} from '@/platform/workspace/api/partnerNodePolicyApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export type PartnerNodePolicyStatus =
  | 'inactive'
  | 'loading'
  | 'unconfigured'
  | 'configured'
  | 'ineligible'
  | 'unavailable'
  | 'error'

export const usePartnerNodeGovernanceStore = defineStore(
  'partnerNodeGovernance',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()

    const providers = shallowRef<readonly PartnerProvider[]>([])
    const policy = shallowRef<PartnerProviderPolicy | null>(null)
    const policyWorkspaceId = ref<string | null>(null)
    const status = ref<PartnerNodePolicyStatus>('inactive')
    const error = shallowRef<Error | null>(null)
    let workspaceVersion = 0

    const governedWorkspaceId = computed(() => {
      const workspace = workspaceStore.activeWorkspace
      return flags.teamWorkspacesEnabled &&
        flags.partnerNodeGovernanceEnabled &&
        workspace?.type === 'team'
        ? workspace.id
        : null
    })

    function isProviderEnabled(providerId: string): boolean {
      if (!policy.value) return true
      return (
        policy.value.providers.find(
          (provider) => provider.providerId === providerId
        )?.enabled === true
      )
    }

    function createInitialPolicy(): PartnerProviderPolicy {
      return {
        enforcementEnabled: false,
        providers: providers.value.map((provider) => ({
          providerId: provider.id,
          enabled: true
        }))
      }
    }

    async function loadPolicy(): Promise<void> {
      const workspaceId = governedWorkspaceId.value
      const version = workspaceVersion
      if (!workspaceId) {
        providers.value = []
        policy.value = null
        policyWorkspaceId.value = null
        status.value = 'inactive'
        error.value = null
        return
      }

      if (policyWorkspaceId.value !== workspaceId) {
        providers.value = []
        policy.value = null
        policyWorkspaceId.value = workspaceId
      }
      status.value = 'loading'
      error.value = null

      try {
        const [nextProviders, nextPolicy] = await Promise.all([
          getPartnerProviders(),
          getPartnerNodePolicy()
        ])
        if (
          version !== workspaceVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }

        providers.value = nextProviders
        policy.value = nextPolicy
        status.value = nextPolicy ? 'configured' : 'unconfigured'
      } catch (loadError) {
        if (
          version !== workspaceVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return
        }
        error.value =
          loadError instanceof Error
            ? loadError
            : new Error('Failed to load partner provider policy')
        if (loadError instanceof PartnerNodePolicyApiError) {
          if (loadError.status === 403) {
            providers.value = []
            policy.value = null
            status.value = 'ineligible'
            return
          }
          if (loadError.status === 503) {
            status.value = 'unavailable'
            return
          }
        }
        status.value = 'error'
      }
    }

    async function savePolicy(
      nextPolicy: PartnerProviderPolicy
    ): Promise<boolean> {
      const workspaceId = governedWorkspaceId.value
      const version = workspaceVersion
      if (!workspaceId || policyWorkspaceId.value !== workspaceId) {
        throw new Error('Partner provider governance is not ready')
      }

      let savedPolicy: PartnerProviderPolicy
      try {
        savedPolicy = await updatePartnerNodePolicy(nextPolicy)
      } catch (saveError) {
        if (
          version !== workspaceVersion ||
          governedWorkspaceId.value !== workspaceId
        ) {
          return false
        }
        throw saveError
      }
      if (
        version !== workspaceVersion ||
        governedWorkspaceId.value !== workspaceId
      ) {
        return false
      }

      policy.value = savedPolicy
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
      providers,
      policy,
      status,
      error,
      governedWorkspaceId,
      isProviderEnabled,
      createInitialPolicy,
      loadPolicy,
      savePolicy
    }
  }
)
