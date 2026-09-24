import { defineStore } from 'pinia'

import { reportError } from '@/platform/telemetry/reportError'

const STORAGE_PREFIX = 'Comfy.Agent.CrdtDocHistory'
const INITIAL_LINEAGE = 'initial'

function segment(value: string): string {
  return encodeURIComponent(value)
}

function resetPrefix(workflowId: string): string {
  return `${STORAGE_PREFIX}|reset|${segment(workflowId)}|`
}

function resetKey(workflowId: string, sequence: number): string {
  return `${resetPrefix(workflowId)}${sequence}`
}

function seenPrefix(workflowId: string, lineage: string): string {
  return `${STORAGE_PREFIX}|seen|${segment(workflowId)}|${segment(lineage)}|`
}

function seenKey(workflowId: string, lineage: string, nodeId: string): string {
  return `${seenPrefix(workflowId, lineage)}${segment(nodeId)}`
}

/**
 * Persists doc-observed node ids for each workflow lineage. Every observed id
 * owns a localStorage key, so concurrent browser contexts can only add keys;
 * they never overwrite another context's set. A reset selects a new lineage
 * namespace, making late writes from stale contexts harmless.
 */
export const useAgentCrdtDocHistoryStore = defineStore(
  'agentCrdtDocHistory',
  () => {
    let available = true

    function accessStorage<T>(fallback: T, operation: () => T): T {
      if (!available) return fallback
      try {
        return operation()
      } catch (error) {
        available = false
        reportError(error, {
          errorType: 'error_accessing_agent_crdt_doc_history'
        })
        return fallback
      }
    }

    function isAvailable(): boolean {
      return available
    }

    function currentLineage(workflowId: string): string {
      return accessStorage(INITIAL_LINEAGE, () => {
        const prefix = resetPrefix(workflowId)
        let latestSequence: number | undefined
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index)
          if (!key?.startsWith(prefix)) continue
          const sequence = Number(key.slice(prefix.length))
          if (
            Number.isSafeInteger(sequence) &&
            (latestSequence === undefined || sequence > latestSequence)
          )
            latestSequence = sequence
        }
        return latestSequence === undefined
          ? INITIAL_LINEAGE
          : `reset:${latestSequence}`
      })
    }

    function remember(
      workflowId: string,
      lineage: string,
      ids: ReadonlySet<string>
    ): void {
      accessStorage(undefined, () => {
        for (const id of ids)
          localStorage.setItem(seenKey(workflowId, lineage, id), '')
      })
    }

    function everSeen(
      workflowId: string,
      lineage: string
    ): ReadonlySet<string> {
      return accessStorage(new Set<string>(), () => {
        const prefix = seenPrefix(workflowId, lineage)
        const ids = new Set<string>()
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index)
          if (key?.startsWith(prefix))
            ids.add(decodeURIComponent(key.slice(prefix.length)))
        }
        return ids
      })
    }

    function reset(workflowId: string, sequence: number): string {
      accessStorage(undefined, () => {
        localStorage.setItem(resetKey(workflowId, sequence), '')
      })
      return currentLineage(workflowId)
    }

    return { isAvailable, currentLineage, remember, everSeen, reset }
  }
)
