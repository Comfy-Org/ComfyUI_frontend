export const AGENT_THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'

export function forgetAgentSessionMemory(): void {
  try {
    localStorage.removeItem(AGENT_THREAD_STORAGE_KEY)
  } catch (error) {
    console.warn('[agent] failed to remove the thread id', error)
  }
}
