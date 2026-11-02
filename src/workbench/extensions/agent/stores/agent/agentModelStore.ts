import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { zAgentModelRefusal } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type {
  AgentModelChoice,
  AgentModels
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  AgentApiError,
  createAgentRestClient
} from '@/workbench/extensions/agent/services/agent/agentRestClient'

const CHOICES_STORAGE_KEY = 'Comfy.Agent.ModelChoiceByThread'
const MAX_REMEMBERED_THREADS = 200
/** Cloud has not answered the login check yet: ask again shortly. */
const CHECKING_RETRY_MS = 3000
const MAX_CHECKING_RETRIES = 5

function readChoices(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

/**
 * The model picker for the local agent host (synap5e/comfy-agent): which
 * models the host offers for this login, and which one each chat uses.
 *
 * An older host has no `/agent/models`; then `supported` stays false, nothing
 * is shown and no `model` is sent, so the panel behaves exactly as before.
 */
export const useAgentModelStore = defineStore('agentModel', () => {
  const api = createAgentRestClient()
  const listing = ref<AgentModels | null>(null)
  const supported = computed(() => listing.value !== null)
  const choices = useLocalStorage<Record<string, string>>(
    CHOICES_STORAGE_KEY,
    {},
    { serializer: { read: readChoices, write: JSON.stringify } }
  )
  /** The pick made in a new chat, before the host has given it an id. */
  const draftChoice = ref<string | null>(null)
  let loadSeq = 0
  let checkingRetries = 0
  let checkingTimer: ReturnType<typeof setTimeout> | undefined

  const available = computed<AgentModelChoice[]>(
    () => listing.value?.models.filter((model) => model.available) ?? []
  )

  function findAvailable(id: string | null | undefined) {
    if (!id) return undefined
    return available.value.find((model) => model.id === id)
  }

  function pickFor(threadId: string | null): string | null {
    if (threadId === null) return draftChoice.value
    return choices.value[threadId] ?? null
  }

  /**
   * What the picker shows for a chat, and so what its next message is sent
   * with: its own pick while that is still offered, else the host's default.
   */
  function selectedFor(threadId: string | null): AgentModelChoice | undefined {
    return (
      findAvailable(pickFor(threadId)) ??
      findAvailable(listing.value?.default) ??
      available.value[0]
    )
  }

  /**
   * The `model` for a turn POST. The id is sent even when it is the default,
   * so the turn runs on what the picker showed, not on a default that moved
   * since (a sign-in changes it).
   */
  function modelForSend(threadId: string | null): string | undefined {
    return selectedFor(threadId)?.id
  }

  function select(threadId: string | null, id: string): void {
    if (threadId === null) {
      draftChoice.value = id
      return
    }
    const { [threadId]: _previous, ...rest } = choices.value
    const kept = Object.entries(rest).slice(-(MAX_REMEMBERED_THREADS - 1))
    choices.value = { ...Object.fromEntries(kept), [threadId]: id }
  }

  /** A new chat's first turn was accepted: its pick now belongs to its id. */
  function adoptDraft(threadId: string): void {
    if (draftChoice.value === null) return
    select(threadId, draftChoice.value)
    draftChoice.value = null
  }

  function scheduleCheckingRetry(models: AgentModels): void {
    clearTimeout(checkingTimer)
    const checking = models.models.some((model) => model.reason === 'checking')
    if (!checking) {
      checkingRetries = 0
      return
    }
    if (checkingRetries >= MAX_CHECKING_RETRIES) return
    checkingRetries += 1
    checkingTimer = setTimeout(() => {
      void load().catch(() => {})
    }, CHECKING_RETRY_MS)
  }

  async function load(): Promise<void> {
    const seq = ++loadSeq
    try {
      const models = await api.getModels()
      if (seq !== loadSeq) return
      listing.value = models
      scheduleCheckingRetry(models)
    } catch (error) {
      if (seq !== loadSeq) return
      if (error instanceof AgentApiError && error.status === 404) {
        listing.value = null
        return
      }
      throw error
    }
  }

  /**
   * The host refused the turn's model (unknown, or no longer available for
   * this login). Drops the chat's pick and refreshes the list, so the picker
   * shows what can be used now. Returns whether the error was such a refusal.
   */
  function handleSendRefusal(error: unknown, threadId: string | null): boolean {
    if (
      !(error instanceof AgentApiError) ||
      (error.status !== 400 && error.status !== 409)
    )
      return false
    if (!zAgentModelRefusal.safeParse(error.body).success) return false
    if (threadId === null) draftChoice.value = null
    else {
      const { [threadId]: _dropped, ...rest } = choices.value
      choices.value = rest
    }
    void load().catch(() => {})
    return true
  }

  return {
    supported,
    available,
    selectedFor,
    modelForSend,
    select,
    adoptDraft,
    load,
    handleSendRefusal
  }
})
