import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  webSessionRequests,
  webSessionSend
} from '@comfyorg/api-client/webSessionFetch'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import {
  getGlobalSetting,
  setGlobalSetting
} from '@/platform/settings/globalSettingsApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { agentSettingsAuthHeader } from '@/workbench/extensions/agent/services/agent/agentAuth'

class AgentConsentAuthenticationError extends Error {
  override name = 'AgentConsentAuthenticationError'
}

export const useAgentConsentStore = defineStore('agentConsent', () => {
  const workspaceStore = useTeamWorkspaceStore()
  const { resolvedUserInfo } = useCurrentUser()
  const loadedIdentity = ref<string | null>(null)
  const acceptedIdentity = ref<string | null>(null)
  const checkSettled = ref(false)
  const checkFailed = ref(false)
  const confirmedAcceptances = ref(0)
  const isChecking = computed(
    () => Boolean(currentUserId()) && !checkSettled.value
  )
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
      checkSettled.value = false
      checkFailed.value = false
    },
    { flush: 'sync' }
  )

  async function ensureScope(): Promise<string | null> {
    const initialSession = session
    const initialUserId = currentUserId()
    try {
      return await resolveScope()
    } catch (error) {
      if (session === initialSession && currentUserId() === initialUserId) {
        checkSettled.value = true
        checkFailed.value = true
      }
      throw error
    }
  }

  async function resolveScope(): Promise<string | null> {
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

  async function requireAuth(sessionId: number, identity: string) {
    const send = webSessionRequests() ? await webSessionSend() : undefined
    const auth = send ?? (await agentSettingsAuthHeader())
    if (!stillOwns(sessionId, identity)) return null
    if (!auth) {
      throw new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      )
    }
    return auth
  }

  async function readConsent(
    sessionId: number,
    identity: string
  ): Promise<boolean> {
    try {
      const auth = await requireAuth(sessionId, identity)
      if (!auth) return false
      const stored = await getGlobalSetting(AGENT_CONSENT_SETTING_ID, auth)
      if (!stillOwns(sessionId, identity)) return false
      if (loadedIdentity.value === identity) return accepted.value

      loadedIdentity.value = identity
      acceptedIdentity.value = stored?.value === true ? identity : null
      checkFailed.value = false
      return accepted.value
    } catch (error) {
      if (!stillOwns(sessionId, identity)) return false
      checkFailed.value = true
      throw error
    } finally {
      if (stillOwns(sessionId, identity)) checkSettled.value = true
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
      const auth = await requireAuth(sessionId, identity)
      if (!auth) return false
      await setGlobalSetting(
        { key: AGENT_CONSENT_SETTING_ID, value: true },
        auth
      )
      if (!stillOwns(sessionId, identity)) return false

      loadedIdentity.value = identity
      acceptedIdentity.value = identity
      checkSettled.value = true
      confirmedAcceptances.value += 1
      return true
    } catch (error) {
      if (!stillOwns(sessionId, identity)) return false
      throw error
    }
  }

  return {
    accepted,
    checkFailed,
    confirmedAcceptances,
    identity,
    isChecking,
    ensureScope,
    load,
    accept
  }
})
