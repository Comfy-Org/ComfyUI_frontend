import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Shorter than agentRunModeStore's own waiter timeout, so a send that never
 * settles frees the gate before anything waiting on it gives up: `api.ts`
 * clears its timer when response HEADERS arrive, so a stalled body is bounded
 * by nothing at all, and a gate held forever means the run-mode control can
 * never be used again without a reload.
 */
const MAX_HOLD_MS = 60_000

/**
 * Counts the messages currently on their way to the server: held from the send
 * click until the POST that carries the message has settled.
 *
 * It exists because that window is not visible anywhere else. The composer's
 * submission looks like it, but New Chat and switching threads both clear it
 * (agentComposerStore.invalidateSubmission) while the POST is still in flight —
 * and neither cancels the turn, they stash it (useAgentSession.newChat), so it
 * keeps running and keeps spending. Anything that must not overtake a sent
 * message has to track the request, not the draft it came from (PM-1660).
 *
 * It orders writes from THIS page only. The server resolves run mode per
 * user, so a second tab's write is ordered against its own sends and can
 * still overtake this one's — closing that needs the ordering point to move
 * to the server, which is where the mode is pinned.
 */
export const useAgentSendGateStore = defineStore('agentSendGate', () => {
  const inFlight = ref(0)

  /**
   * Marks one message as on its way and returns ITS release. The release is
   * single-use, so a caller cannot decrement a hold it does not own, and it
   * fires on its own after MAX_HOLD_MS, so a send that never settles cannot
   * strand the gate. Both matter: `isSending` reading false during a live send
   * silently reopens the ordering hole this store exists to close.
   */
  function begin(): () => void {
    inFlight.value += 1
    let released = false
    const release = (): void => {
      if (released) return
      released = true
      clearTimeout(backstop)
      inFlight.value = Math.max(0, inFlight.value - 1)
    }
    const backstop = setTimeout(release, MAX_HOLD_MS)
    return release
  }

  return { isSending: computed(() => inFlight.value > 0), begin }
})
