import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import {
  getAccountSetting,
  setAccountSetting
} from '@/platform/settings/accountSettingsApi'
import { useAuthStore } from '@/stores/authStore'

class AgentConsentAuthenticationError extends Error {
  override name = 'AgentConsentAuthenticationError'
}

export const useAgentConsentStore = defineStore('agentConsent', () => {
  const authStore = useAuthStore()
  const { resolvedUserInfo } = useCurrentUser()
  const loadedIdentity = ref<string | null>(null)
  const acceptedIdentity = ref<string | null>(null)
  let session = 0
  let pendingLoad: { identity: string; result: Promise<boolean> } | null = null

  const currentIdentity = () => resolvedUserInfo.value?.id ?? null
  const identity = computed(currentIdentity)
  const accepted = computed(
    () =>
      currentIdentity() !== null && acceptedIdentity.value === currentIdentity()
  )

  watch(
    currentIdentity,
    () => {
      session += 1
      pendingLoad = null
      loadedIdentity.value = null
      acceptedIdentity.value = null
    },
    { flush: 'sync' }
  )

  function requireIdentity(): string {
    const identity = currentIdentity()
    if (!identity) {
      throw new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      )
    }
    return identity
  }

  function stillOwns(sessionId: number, identity: string): boolean {
    return session === sessionId && currentIdentity() === identity
  }

  async function requireAuthHeader(sessionId: number, identity: string) {
    const authHeader = await authStore.getUserAuthHeader()
    if (!stillOwns(sessionId, identity)) return null
    if (!authHeader) {
      throw new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      )
    }
    return authHeader
  }

  async function readAccountConsent(
    sessionId: number,
    identity: string
  ): Promise<boolean> {
    const authHeader = await requireAuthHeader(sessionId, identity)
    if (!authHeader) return false

    const stored = await getAccountSetting(AGENT_CONSENT_SETTING_ID, authHeader)
    if (!stillOwns(sessionId, identity)) return false
    if (loadedIdentity.value === identity) return accepted.value

    loadedIdentity.value = identity
    acceptedIdentity.value = stored === true ? identity : null
    return accepted.value
  }

  async function load(): Promise<boolean> {
    const identity = requireIdentity()
    if (loadedIdentity.value === identity) return accepted.value
    if (pendingLoad?.identity === identity) return pendingLoad.result

    const result = readAccountConsent(session, identity)
    const request = { identity, result }
    pendingLoad = request
    try {
      return await result
    } finally {
      if (pendingLoad === request) pendingLoad = null
    }
  }

  async function accept(expectedIdentity?: string): Promise<boolean> {
    const identity = requireIdentity()
    if (expectedIdentity && identity !== expectedIdentity) return false

    const sessionId = session
    const authHeader = await requireAuthHeader(sessionId, identity)
    if (!authHeader) return false

    await setAccountSetting(AGENT_CONSENT_SETTING_ID, true, authHeader)
    if (!stillOwns(sessionId, identity)) return false

    loadedIdentity.value = identity
    acceptedIdentity.value = identity
    return true
  }

  return { accepted, identity, load, accept }
})
