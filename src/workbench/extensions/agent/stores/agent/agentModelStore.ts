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
/**
 * When to ask for the list again on its own. `checking`: Cloud has not
 * answered the login check yet. `not_signed_in`: the page asked before
 * Firebase restored a sign-in, which happens a few seconds after load.
 */
const RETRY_PLAN: Record<string, { ms: number; tries: number }> = {
  checking: { ms: 3000, tries: 5 },
  not_signed_in: { ms: 10_000, tries: 6 }
}

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
  let retryReason: string | null = null
  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

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
   * What the picker shows for a chat, and so what its next message runs on:
   * its own pick while that is still offered, else the host's default. The
   * default is shown even when it can't be used (`available: false`, e.g. the
   * cloud route refused this account): the host does not fall back quietly,
   * so the picker shows why and the person picks another model.
   */
  function selectedFor(threadId: string | null): AgentModelChoice | undefined {
    const fallback = listing.value?.models.find(
      (model) => model.id === listing.value?.default
    )
    return findAvailable(pickFor(threadId)) ?? fallback ?? available.value[0]
  }

  /**
   * The `model` for a turn POST: the chat's own pick while it is offered.
   * Without one nothing is sent and the host uses its default as of that
   * request, which stays right when a sign-in has changed it since the list
   * was fetched.
   */
  function modelForSend(threadId: string | null): string | undefined {
    return findAvailable(pickFor(threadId))?.id
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

  function scheduleRetry(models: AgentModels): void {
    clearTimeout(retryTimer)
    const reasons = new Set(models.models.map((model) => model.reason))
    const reason = Object.keys(RETRY_PLAN).find((r) => reasons.has(r)) ?? null
    if (reason !== retryReason) {
      retryReason = reason
      retries = 0
    }
    if (reason === null) return
    const plan = RETRY_PLAN[reason]
    if (retries >= plan.tries) return
    retries += 1
    retryTimer = setTimeout(() => {
      void load().catch(() => {})
    }, plan.ms)
  }

  async function load(): Promise<void> {
    const seq = ++loadSeq
    try {
      const models = await api.getModels()
      if (seq !== loadSeq) return
      listing.value = models
      scheduleRetry(models)
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
