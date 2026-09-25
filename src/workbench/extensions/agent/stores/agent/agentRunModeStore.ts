import { until, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

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
const DEFAULT_CREDIT_LIMIT = 300
const PREFERENCE_STORAGE_KEY = 'Comfy.Agent.RunModePreference'
const LEGACY_MODE_STORAGE_KEY = 'Comfy.Agent.RunMode'
const LEGACY_CREDIT_LIMIT_STORAGE_KEY = 'Comfy.Agent.RunCreditLimit'
/**
 * Defence in depth behind the gate's own MAX_HOLD_MS, which is shorter: a
 * send that never settles is released there, so this should not fire. It
 * exists for the case the gate itself is wrong.
 */
const SEND_WAIT_TIMEOUT_MS = 90_000

class AgentSendWaitTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    // Without this every pipeline that groups by error name files the
    // timeout this class exists to make legible under plain 'Error'.
    this.name = 'AgentSendWaitTimeoutError'
  }
}

function migrateLegacyPreference(): void {
  const storedPreference = localStorage.getItem(PREFERENCE_STORAGE_KEY)
  const legacyMode = localStorage.getItem(LEGACY_MODE_STORAGE_KEY)
  const legacyCreditLimit = localStorage.getItem(
    LEGACY_CREDIT_LIMIT_STORAGE_KEY
  )
  let canRemoveLegacy = storedPreference !== null

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
      canRemoveLegacy = true
    }
  }

  if (canRemoveLegacy && (legacyMode !== null || legacyCreditLimit !== null)) {
    localStorage.removeItem(LEGACY_MODE_STORAGE_KEY)
    localStorage.removeItem(LEGACY_CREDIT_LIMIT_STORAGE_KEY)
  }
}

/**
 * Resolves once no message is still on its way to the server. The server pins
 * a turn's run mode when that turn's POST ARRIVES, not when the user pressed
 * send, so a mode written while the composer already looks sent overtakes the
 * message and re-authorizes it (PM-1660).
 *
 * REJECTS rather than waits forever if the send never settles. A send is only
 * bounded as far as its response HEADERS (api.ts clears its timer when those
 * arrive, not when the body does), so a stalled body would otherwise leave
 * every later write pending and the popover disabled until a reload. Failing
 * is the safe direction on a spend gate: the user is told to retry, and no
 * mode is written behind a message whose turn may still be unstarted.
 */
function sendInFlight(): Promise<unknown> | undefined {
  const sendGate = useAgentSendGateStore()
  if (!sendGate.isSending) return
  return until(() => sendGate.isSending)
    .toBe(false, {
      flush: 'sync',
      timeout: SEND_WAIT_TIMEOUT_MS,
      throwOnTimeout: true
    })
    .catch(() => {
      // until() rejects with the bare string 'Timeout', which reads as
      // nothing in the error consoles the popover reports to.
      throw new AgentSendWaitTimeoutError(
        'timed out waiting for a message already sent'
      )
    })
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
    nextMode: AgentRunModeValue,
    nextLimit: number | null
  ): Promise<void> {
    const next = zAgentRunMode.parse({
      mode: nextMode,
      credit_limit: nextLimit
    })
    const revision = ++saveRevision
    const applySaved = (savedPreference: AgentRunModePreference) => {
      if (revision <= appliedSaveRevision) return
      appliedSaveRevision = revision
      apply(savedPreference)
    }
    // The picked mode is deliberately NOT applied here: this control shows
    // what is SAVED, with the popover's own spinner covering the write (see
    // Composer.test.ts, 'blocks a second pick while the write is in flight').
    // Waiting for a send in flight widens that window; it does not change it.
    try {
      const held = sendInFlight()
      if (held !== undefined) await held
      // A second pick can park on the same gate (two popover instances, or
      // one remounted mid-write) and both wake on the same release, so their
      // PUTs would race and the server would keep whichever landed last.
      if (revision !== saveRevision) return
      applySaved(await api.putRunMode(next))
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) throw error
      applySaved(next)
    }
  }

  localPreference()

  return { mode, creditLimit, load, save }
})
