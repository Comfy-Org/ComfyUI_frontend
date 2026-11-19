import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface TranscriptFetch {
  threadId: string
  outdated: boolean
}

/** In-flight transcript fetch handle with its server promise and staleness check. */
export interface TranscriptRead {
  answer: Promise<AgentMessages>
  isOutdated: () => boolean
}

/** Tracks in-flight transcript reads and marks them outdated when chat state changes. */
export function createTranscriptCache() {
  const inFlight = new Set<TranscriptFetch>()

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
      throw error
    }
    answer.then(
      () => {
        inFlight.delete(request)
      },
      () => {
        inFlight.delete(request)
      }
    )
    return { answer, isOutdated: () => request.outdated }
  }

  function isFetching(threadId: string): boolean {
    return [...inFlight].some((request) => request.threadId === threadId)
  }

  function touch(threadId: string): void {
    for (const request of inFlight) {
      if (request.threadId === threadId) request.outdated = true
    }
  }

  function touchAll(): void {
    for (const request of inFlight) request.outdated = true
  }

  return {
    fetch,
    isFetching,
    touch,
    touchAll
  }
}
