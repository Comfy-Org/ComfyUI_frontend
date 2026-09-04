import { reportError } from '@/platform/telemetry/reportError'

export const AGENT_THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const AGENT_THREAD_OWNER_STORAGE_KEY = 'Comfy.Agent.ThreadOwnerId'
const STORAGE_ERROR_TYPE = 'agent_session_memory_storage_failure'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    reportError(error, { errorType: STORAGE_ERROR_TYPE })
    return null
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    reportError(error, { errorType: STORAGE_ERROR_TYPE })
    return false
  }
}

function removeStorage(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    reportError(error, { errorType: STORAGE_ERROR_TYPE })
    return false
  }
}

export function readAgentSessionMemory(userId?: string | null): string | null {
  if (userId === null) return null

  const threadId = readStorage(AGENT_THREAD_STORAGE_KEY)
  if (userId === undefined || threadId === null) return threadId

  return readStorage(AGENT_THREAD_OWNER_STORAGE_KEY) === userId
    ? threadId
    : null
}

export function rememberAgentSessionMemory(
  threadId: string,
  userId?: string | null
): void {
  if (userId === null) return

  if (!writeStorage(AGENT_THREAD_STORAGE_KEY, threadId)) return
  if (userId === undefined) {
    removeStorage(AGENT_THREAD_OWNER_STORAGE_KEY)
  } else {
    writeStorage(AGENT_THREAD_OWNER_STORAGE_KEY, userId)
  }
}

export function hasAgentSessionMemoryFor(userId: string | null): boolean {
  return userId !== null && readAgentSessionMemory(userId) !== null
}

export function forgetAgentSessionMemory(): void {
  removeStorage(AGENT_THREAD_STORAGE_KEY)
  removeStorage(AGENT_THREAD_OWNER_STORAGE_KEY)
}
