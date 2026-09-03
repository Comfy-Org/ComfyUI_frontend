export const AGENT_THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const AGENT_THREAD_OWNER_STORAGE_KEY = 'Comfy.Agent.ThreadOwnerId'

export function readAgentSessionMemory(userId?: string | null): string | null {
  if (userId === null) return null

  const threadId = localStorage.getItem(AGENT_THREAD_STORAGE_KEY)
  if (userId === undefined || threadId === null) return threadId

  return localStorage.getItem(AGENT_THREAD_OWNER_STORAGE_KEY) === userId
    ? threadId
    : null
}

export function rememberAgentSessionMemory(
  threadId: string,
  userId?: string | null
): void {
  if (userId === null) return

  localStorage.setItem(AGENT_THREAD_STORAGE_KEY, threadId)
  if (userId === undefined) {
    localStorage.removeItem(AGENT_THREAD_OWNER_STORAGE_KEY)
  } else {
    localStorage.setItem(AGENT_THREAD_OWNER_STORAGE_KEY, userId)
  }
}

export function hasAgentSessionMemoryFor(userId: string | null): boolean {
  return userId !== null && readAgentSessionMemory(userId) !== null
}

export function forgetAgentSessionMemory(): void {
  try {
    localStorage.removeItem(AGENT_THREAD_STORAGE_KEY)
    localStorage.removeItem(AGENT_THREAD_OWNER_STORAGE_KEY)
  } catch (error) {
    console.warn('[agent] failed to remove the thread id', error)
  }
}
