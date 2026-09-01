// A leaf on purpose: the app-scope purge needs the stored thread id and
// nothing else, so importing it must not statically reach useAgentSession's
// closure and drag the REST client, event transport, and its module-scope
// schemas into the unconditional boot chunk.
export const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'

export function forgetAgentSessionMemory(): void {
  try {
    localStorage.removeItem(THREAD_STORAGE_KEY)
  } catch (error) {
    console.warn('[agent] failed to remove the thread id', error)
  }
}
