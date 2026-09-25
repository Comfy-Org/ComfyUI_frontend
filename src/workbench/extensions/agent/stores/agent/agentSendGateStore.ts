import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
 *
 * The ordering is also one-directional: it holds a mode write behind a send,
 * never a send behind a mode write. A message sent in the microtask after a
 * deferred write is released could still reach the server first, which the
 * same server-side ordering point would be needed to close.
 */
export const useAgentSendGateStore = defineStore('agentSendGate', () => {
  const inFlight = ref(0)

  function begin(): void {
    inFlight.value += 1
  }

  function end(): void {
    inFlight.value -= 1
  }

  return { isSending: computed(() => inFlight.value > 0), begin, end }
})
