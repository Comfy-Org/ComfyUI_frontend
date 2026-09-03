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
export const DEFAULT_CREDIT_LIMIT = 300
const PREFERENCE_STORAGE_KEY = 'Comfy.Agent.RunModePreference'
const LEGACY_MODE_STORAGE_KEY = 'Comfy.Agent.RunMode'
const LEGACY_CREDIT_LIMIT_STORAGE_KEY = 'Comfy.Agent.RunCreditLimit'

function migrateLegacyPreference(): void {
  const storedPreference = localStorage.getItem(PREFERENCE_STORAGE_KEY)
  const legacyMode = localStorage.getItem(LEGACY_MODE_STORAGE_KEY)
  const legacyCreditLimit = localStorage.getItem(
    LEGACY_CREDIT_LIMIT_STORAGE_KEY
  )

  if (storedPreference === null && legacyMode !== null) {
    const mode = {
      ask: 'ask_approval',
      auto: 'auto',
      'auto-limit': 'auto_limited'
    }[legacyMode]
    const parsedCreditLimit = Number(legacyCreditLimit)
    const creditLimit =
      legacyCreditLimit !== null &&
      legacyCreditLimit !== '' &&
      Number.isInteger(parsedCreditLimit) &&
      parsedCreditLimit > 0
        ? parsedCreditLimit
        : DEFAULT_CREDIT_LIMIT
    const migrated = zAgentRunMode.safeParse({
      mode,
      credit_limit: mode === 'auto_limited' ? creditLimit : null
    })
    if (migrated.success) {
      localStorage.setItem(
        PREFERENCE_STORAGE_KEY,
        JSON.stringify(migrated.data)
      )
    }
  }

  if (legacyMode !== null || legacyCreditLimit !== null) {
    localStorage.removeItem(LEGACY_MODE_STORAGE_KEY)
    localStorage.removeItem(LEGACY_CREDIT_LIMIT_STORAGE_KEY)
  }
}

export const useAgentRunModeStore = defineStore('agentRunMode', () => {
  const api = createAgentRestClient()
  migrateLegacyPreference()
  const preference = useLocalStorage<AgentRunModePreference>(
    PREFERENCE_STORAGE_KEY,
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
    saveRevision++
    try {
      const savedPreference = await api.putRunMode(preference)
      apply(savedPreference)
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      apply(preference)
    }
  }

  localPreference()

  return { mode, creditLimit, load, save }
})
