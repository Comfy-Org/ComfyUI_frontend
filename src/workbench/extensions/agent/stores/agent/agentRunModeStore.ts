import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import {
  useAccountScope,
  useAccountStorage
} from '@/platform/workflow/persistence/composables/useAccountStorage'

import { zAgentRunMode } from '../../schemas/agentApiSchema'
import type {
  AgentRunModePreference,
  AgentRunModeValue
} from '../../schemas/agentApiSchema'
export type { AgentRunModeValue } from '../../schemas/agentApiSchema'
import {
  AgentApiError,
  createAgentRestClient
} from '../../services/agent/agentRestClient'
import { useAgentSendGateStore } from './agentSendGateStore'

const DEFAULT_PREFERENCE: AgentRunModePreference = {
  mode: 'ask_approval',
  credit_limit: null
}

export const useAgentRunModeStore = defineStore('agentRunMode', () => {
  const api = createAgentRestClient()
  const scope = useAccountScope()
  const preference = useAccountStorage<AgentRunModePreference>(
    StorageKeys.agentRunModePreference,
    DEFAULT_PREFERENCE,
    {
      serializer: {
        read: (value) => {
          try {
            return zAgentRunMode
              .catch(DEFAULT_PREFERENCE)
              .parse(JSON.parse(value))
          } catch {
            return DEFAULT_PREFERENCE
          }
        },
        write: JSON.stringify
      }
    },
    scope
  )
  const mode = computed(() => preference.value.mode)
  const creditLimit = computed(() => preference.value.credit_limit)
  let saveRevision = 0
  let appliedSaveRevision = 0

  function apply(nextPreference: AgentRunModePreference): void {
    preference.value = nextPreference
  }

  function localPreference(): AgentRunModePreference {
    const parsed = zAgentRunMode.safeParse(preference.value)
    if (parsed.success) return parsed.data

    apply(DEFAULT_PREFERENCE)
    return DEFAULT_PREFERENCE
  }

  async function load(): Promise<void> {
    const owner = scope.value
    const revision = saveRevision
    const appliedRevision = appliedSaveRevision
    try {
      const serverPreference = await api.getRunMode()
      if (
        owner === scope.value &&
        revision === saveRevision &&
        appliedRevision === appliedSaveRevision
      )
        apply(serverPreference)
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      localPreference()
    }
  }

  async function save(
    nextMode: AgentRunModeValue,
    nextLimit: number | null
  ): Promise<void> {
    const owner = scope.value
    const next = zAgentRunMode.parse({
      mode: nextMode,
      credit_limit: nextLimit
    })
    const revision = ++saveRevision
    const applySaved = (savedPreference: AgentRunModePreference) => {
      if (owner !== scope.value || revision <= appliedSaveRevision) return
      appliedSaveRevision = revision
      apply(savedPreference)
    }
    try {
      const sendGate = useAgentSendGateStore()
      if (sendGate.isSending) await until(() => sendGate.isSending).toBe(false)
      if (owner !== scope.value || revision !== saveRevision) return
      applySaved(await api.putRunMode(next))
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      applySaved(next)
    }
  }

  localPreference()

  return { mode, creditLimit, load, save }
})
