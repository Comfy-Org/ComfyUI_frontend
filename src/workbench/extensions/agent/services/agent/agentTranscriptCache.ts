import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'

const KEPT_TRANSCRIPTS = 12

interface TranscriptFetch {
  threadId: string
  outdated: boolean
}

export interface TranscriptRead {
  answer: Promise<AgentMessages>
  isOutdated: () => boolean
}

export function createTranscriptCache(capacity = KEPT_TRANSCRIPTS) {
  const kept = new Map<string, AgentMessages>()
  const inFlight = new Set<TranscriptFetch>()

  function keep(threadId: string, history: AgentMessages): void {
    kept.delete(threadId)
    kept.set(threadId, history)
    for (const oldest of kept.keys()) {
      if (kept.size <= capacity) break
      kept.delete(oldest)
    }
  }

  function fetch(
    threadId: string,
    load: () => Promise<AgentMessages>
  ): TranscriptRead {
    const request: TranscriptFetch = { threadId, outdated: false }
    inFlight.add(request)
    let answer: Promise<AgentMessages>
    try {
      answer = load()
    } catch (error) {
      inFlight.delete(request)
      kept.delete(threadId)
      throw error
    }
    answer.then(
      (history) => {
        inFlight.delete(request)
        const settled = history.every((row) => row.status !== 'streaming')
        if (settled && !request.outdated) keep(threadId, history)
      },
      () => {
        inFlight.delete(request)
        kept.delete(threadId)
      }
    )
    return { answer, isOutdated: () => request.outdated }
  }

  function recall(threadId: string): AgentMessages | undefined {
    const history = kept.get(threadId)
    if (history !== undefined) keep(threadId, history)
    return history
  }

  function has(threadId: string): boolean {
    return kept.has(threadId)
  }

  function isFetching(threadId: string): boolean {
    return [...inFlight].some((request) => request.threadId === threadId)
  }

  function touch(threadId: string): void {
    kept.delete(threadId)
    for (const request of inFlight) {
      if (request.threadId === threadId) request.outdated = true
    }
  }

  function touchAll(): void {
    kept.clear()
    for (const request of inFlight) request.outdated = true
  }

  return {
    fetch,
    recall,
    has,
    isFetching,
    touch,
    touchAll,
    clear: touchAll
  }
}
