import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { zAgentRunMode } from '../../schemas/agentApiSchema'
import type {
  AgentRunMode,
  AgentRunModePreference
} from '../../schemas/agentApiSchema'
export type { AgentRunMode } from '../../schemas/agentApiSchema'
import {
  AgentApiError,
  createAgentRestClient
} from '../../services/agent/agentRestClient'

const DEFAULT_PREFERENCE: AgentRunModePreference = {
  mode: 'ask_approval',
  credit_limit: null
}

export const useAgentRunModeStore = defineStore('agentRunMode', () => {
  const api = createAgentRestClient()
  const preference = useLocalStorage<AgentRunModePreference>(
    'Comfy.Agent.RunModePreference',
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
    }
  )
  const mode = computed(() => preference.value.mode)
  const creditLimit = computed(() => preference.value.credit_limit)
  let saveRevision = 0

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
    const revision = saveRevision
    try {
      const serverPreference = await api.getRunMode()
      if (revision === saveRevision) apply(serverPreference)
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      localPreference()
    }
  }

  async function save(
    nextMode: AgentRunMode,
    nextLimit: number | null
  ): Promise<void> {
    const preference = zAgentRunMode.parse({
      mode: nextMode,
      credit_limit: nextLimit
    })
    try {
      const savedPreference = await api.putRunMode(preference)
      saveRevision++
      apply(savedPreference)
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      saveRevision++
      apply(preference)
    }
  }

  localPreference()

  return { mode, creditLimit, load, save }
})
