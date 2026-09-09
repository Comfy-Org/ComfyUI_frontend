import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import {
  getGlobalSetting,
  setGlobalSetting
} from '@/platform/settings/globalSettingsApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

class AgentConsentAuthenticationError extends Error {
  override name = 'AgentConsentAuthenticationError'
}

export const useAgentConsentStore = defineStore('agentConsent', () => {
  const authStore = useAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const { resolvedUserInfo } = useCurrentUser()
  const loadedIdentity = ref<string | null>(null)
  const acceptedIdentity = ref<string | null>(null)
  let session = 0
  let pendingLoad: { identity: string; result: Promise<boolean> } | null = null

  function currentUserId(): string | undefined {
    return resolvedUserInfo.value?.id
  }

  function currentIdentity(): string | null {
    const userId = currentUserId()
    const workspaceId = workspaceStore.activeWorkspaceId
    if (!userId || !workspaceId || workspaceStore.isSwitching) return null
    return JSON.stringify([
      userId,
      workspaceId,
      workspaceStore.workspaceTransitionGeneration
    ])
  }
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

  async function ensureScope(): Promise<string | null> {
    const userId = currentUserId()
    if (!userId) {
      throw new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      )
    }
    const generation = workspaceStore.workspaceTransitionGeneration
    if (!workspaceStore.activeWorkspaceId && !workspaceStore.isSwitching) {
      await workspaceStore.initialize()
    }
    if (
      currentUserId() !== userId ||
      workspaceStore.workspaceTransitionGeneration !== generation ||
      workspaceStore.isSwitching
    )
      return null
    const scope = currentIdentity()
    if (!scope) {
      throw new AgentConsentAuthenticationError(
        'Comfy workspace authentication is required'
      )
    }
    return scope
  }

  function stillOwns(sessionId: number, identity: string): boolean {
    return session === sessionId && currentIdentity() === identity
  }

  async function requireAuthHeader(sessionId: number, identity: string) {
    const authHeader = await authStore.getWorkspaceAuthHeader()
    if (!stillOwns(sessionId, identity)) return null
    if (!authHeader) {
      throw new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      )
    }
    return authHeader
  }

  async function readConsent(
    sessionId: number,
    identity: string
  ): Promise<boolean> {
    try {
      const authHeader = await requireAuthHeader(sessionId, identity)
      if (!authHeader) return false
      const stored = await getGlobalSetting(
        AGENT_CONSENT_SETTING_ID,
        authHeader
      )
      if (!stillOwns(sessionId, identity)) return false
      if (loadedIdentity.value === identity) return accepted.value

      loadedIdentity.value = identity
      acceptedIdentity.value = stored?.value === true ? identity : null
      return accepted.value
    } catch (error) {
      if (!stillOwns(sessionId, identity)) return false
      throw error
    }
  }

  async function load(): Promise<boolean> {
    const identity = await ensureScope()
    if (!identity) return false
    if (loadedIdentity.value === identity) return accepted.value
    if (pendingLoad?.identity === identity) return pendingLoad.result

    const result = readConsent(session, identity)
    const request = { identity, result }
    pendingLoad = request
    try {
      return await result
    } finally {
      if (pendingLoad === request) pendingLoad = null
    }
  }

  async function accept(expectedIdentity?: string): Promise<boolean> {
    const identity = await ensureScope()
    if (!identity) return false
    if (expectedIdentity && identity !== expectedIdentity) return false

    const sessionId = session
    try {
      const authHeader = await requireAuthHeader(sessionId, identity)
      if (!authHeader) return false
      await setGlobalSetting(
        { key: AGENT_CONSENT_SETTING_ID, value: true },
        authHeader
      )
      if (!stillOwns(sessionId, identity)) return false

      loadedIdentity.value = identity
      acceptedIdentity.value = identity
      return true
    } catch (error) {
      if (!stillOwns(sessionId, identity)) return false
      throw error
    }
  }

  return { accepted, identity, ensureScope, load, accept }
})
