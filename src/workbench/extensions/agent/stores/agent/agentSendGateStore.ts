import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Deliberately longer than every path that can still deliver the POST, so the
 * backstop cannot release the gate while the message is still on its way and
 * let a run-mode write overtake it. `api.ts` bounds the request at 10s of auth
 * initialisation plus a 60s response-HEADERS timeout, and a 401 remint arms a
 * fresh 60s timer — ~130s before the request either reaches the server or is
 * aborted (and an abort releases the gate through performSend's own `finally`).
 *
 * Past that the only unbounded case left is a stalled response BODY, and
 * headers having arrived means the server already received the POST and
 * already pinned the turn's run mode: the ordering this gate protects is
 * settled, so releasing is safe. Shorter than agentRunModeStore's waiter, so
 * that waiter fires only if this backstop itself failed.
 */
const MAX_HOLD_MS = 150_000

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
