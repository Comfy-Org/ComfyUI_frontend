import { shallowRef } from 'vue'
import type { InjectionKey, ShallowRef } from 'vue'

import {
  conversationFrom,
  fitWithin,
  historyKey,
  isEmptyHistory,
  isHistoryKey,
  parseStored,
  savedAtOf,
  storedFrom
} from './historyStorage'
import type { PendingFollowUp, StoredHistory } from './historyStorage'
import { emptyConversation } from './turns'
import type { Conversation } from './turns'

type HistoryStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>

export interface HistorySettings {
  /** False keeps every history in memory only: nothing is read or written. */
  enabled: boolean
  /** The most characters of JSON stored for one workflow. */
  maxCharsPerWorkflow: number
  /** The most workflows with a stored history; the least recently saved go first. */
  maxWorkflows: number
}

/** Read once when the layer starts; change a value here and reload the page. */
export const historySettings: HistorySettings = {
  enabled: true,
  maxCharsPerWorkflow: 100_000,
  maxWorkflows: 20
}

/** Keeps each workflow's history: in memory for this page, and in the browser's storage across reloads. */
export interface HistoryKeeper {
  /** The history of a workflow as it was last kept; empty when there is none. */
  load(workflowKey: string | null): Conversation
  /** A workflow without a key is kept in memory only. */
  keep(
    workflowKey: string | null,
    conversation: Conversation,
    pendingFollowUp: PendingFollowUp | null
  ): void
  /** True while the latest save did not reach the browser's storage. */
  unsaved: Readonly<ShallowRef<boolean>>
}

export const HISTORY_KEEPER: InjectionKey<HistoryKeeper> = Symbol(
  'pointAtItHistoryKeeper'
)

const NO_WORKFLOW = ''

function historyKeys(storage: HistoryStorage): string[] {
  return Array.from({ length: storage.length }, (_, index) =>
    storage.key(index)
  ).filter((key): key is string => key !== null && isHistoryKey(key))
}

function removeLeastRecent(storage: HistoryStorage, keep: number): void {
  const oldestFirst = historyKeys(storage)
    .map((key) => ({ key, savedAt: savedAtOf(storage.getItem(key)) }))
    .sort((a, b) => a.savedAt - b.savedAt)
  for (const { key } of oldestFirst.slice(0, -keep)) storage.removeItem(key)
}

/**
 * `openStorage` returns the browser's storage and may throw when it is
 * blocked. Null, or `enabled` false, means nothing is ever read or written.
 */
export function createHistoryKeeper(
  openStorage: (() => HistoryStorage) | null,
  settings: HistorySettings,
  now: () => number = Date.now
): HistoryKeeper {
  const open = settings.enabled ? openStorage : null
  const memory = new Map<string, StoredHistory>()
  const unsaved = shallowRef(false)

  function read(workflowKey: string): StoredHistory | null {
    if (!open) return null
    try {
      return parseStored(open().getItem(historyKey(workflowKey)))
    } catch {
      return null
    }
  }

  function write(workflowKey: string, stored: StoredHistory): void {
    if (!open) return
    const key = historyKey(workflowKey)
    try {
      const storage = open()
      if (isEmptyHistory(stored)) {
        storage.removeItem(key)
      } else {
        const isNew = storage.getItem(key) === null
        storage.setItem(
          key,
          JSON.stringify(fitWithin(stored, settings.maxCharsPerWorkflow))
        )
        if (isNew) removeLeastRecent(storage, settings.maxWorkflows)
      }
      unsaved.value = false
    } catch {
      unsaved.value = true
    }
  }

  return {
    unsaved,
    load(workflowKey) {
      const kept =
        memory.get(workflowKey ?? NO_WORKFLOW) ??
        (workflowKey === null ? null : read(workflowKey))
      return kept ? conversationFrom(kept) : emptyConversation
    },
    keep(workflowKey, conversation, pendingFollowUp) {
      const stored = storedFrom(conversation, pendingFollowUp, now())
      const name = workflowKey ?? NO_WORKFLOW
      if (isEmptyHistory(stored)) memory.delete(name)
      else memory.set(name, stored)
      if (workflowKey !== null) write(workflowKey, stored)
    }
  }
}
