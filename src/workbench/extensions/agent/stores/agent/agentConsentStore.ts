import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import {
  getAccountSetting,
  setAccountSetting
} from '@/platform/settings/accountSettingsApi'
import { useAuthStore } from '@/stores/authStore'

export const useAgentConsentStore = defineStore('agentConsent', () => {
  const authStore = useAuthStore()
  const { resolvedUserInfo } = useCurrentUser()
  const loadedIdentity = ref<string | null>(null)
  const acceptedIdentity = ref<string | null>(null)
  let operation = 0

  const currentIdentity = () => resolvedUserInfo.value?.id ?? null
  const identity = computed(currentIdentity)
  const accepted = computed(
    () =>
      currentIdentity() !== null && acceptedIdentity.value === currentIdentity()
  )

  watch(
    currentIdentity,
    () => {
      operation += 1
      loadedIdentity.value = null
      acceptedIdentity.value = null
    },
    { flush: 'sync' }
  )

  function requireIdentity(): string {
    const identity = currentIdentity()
    if (!identity) throw new Error('Comfy account authentication is required')
    return identity
  }

  function stillOwns(operationId: number, identity: string): boolean {
    return operation === operationId && currentIdentity() === identity
  }

  async function load(): Promise<boolean> {
    const identity = requireIdentity()
    if (loadedIdentity.value === identity) return accepted.value

    const operationId = ++operation
    const authHeader = await authStore.getUserAuthHeader()
    if (!stillOwns(operationId, identity)) return false
    if (!authHeader) throw new Error('Comfy account authentication is required')

    const stored = await getAccountSetting(AGENT_CONSENT_SETTING_ID, authHeader)
    if (!stillOwns(operationId, identity)) return false

    loadedIdentity.value = identity
    acceptedIdentity.value = stored === true ? identity : null
    return accepted.value
  }

  async function accept(expectedIdentity?: string): Promise<boolean> {
    const identity = requireIdentity()
    if (expectedIdentity && identity !== expectedIdentity) return false

    const operationId = ++operation
    const authHeader = await authStore.getUserAuthHeader()
    if (!stillOwns(operationId, identity)) return false
    if (!authHeader) throw new Error('Comfy account authentication is required')

    await setAccountSetting(AGENT_CONSENT_SETTING_ID, true, authHeader)
    if (!stillOwns(operationId, identity)) return false

    loadedIdentity.value = identity
    acceptedIdentity.value = identity
    return true
  }

  return { accepted, identity, load, accept }
})
