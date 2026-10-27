import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  AUTH_INIT_TIMEOUT_MS,
  FETCH_RESPONSE_HEADERS_TIMEOUT_MS
} from '@/scripts/apiTimeouts'

/**
 * A 401 remint, which runs BETWEEN the two response-headers timers: `api.ts`
 * clears the first one before re-minting and arms the second after. Budgeted
 * rather than imported — the 15s ceiling is `DEFAULT_MINT_TIMEOUT_MS`, private
 * to `packages/account-core/src/core/session.ts`, and the unified-user wait in
 * front of it has no ceiling at all.
 */
const REMINT_BUDGET_MS = 30_000

/**
 * Everything the hold covers before the first response timer is armed:
 * `prepareWorkflow()`'s own 3s race, plus `getAuthHeader()` and
 * `shouldRemintCloudRequest()`'s dynamic import, neither of which has a
 * ceiling. A budget, not a bound — making it provable needs an overall
 * deadline on the request or a release tied to its dispatch.
 */
const SEND_PRELUDE_BUDGET_MS = 30_000

/**
 * Deliberately longer than every path that can still deliver the POST, so the
 * backstop cannot release the gate while the message is still on its way and
 * let a run-mode write overtake it.
 *
 * DERIVED rather than transcribed, because a hand-summed 150s here sat BELOW
 * its own window: 3s of prepare + 10s of auth init + 60s + a 15s remint + a
 * second 60s is 148s, and a slower remint makes it 163s, so a retried POST
 * could land after the backstop had already let a parked PUT through — the
 * PM-1660 ordering again.
 *
 * Past this the only unbounded case left is a stalled response BODY, and
 * headers having arrived means the server already ran `resolveRunMode`: cloud
 * `services/agent/server/agent_handler.go` pins the turn's mode inside
 * `postMessage` before it writes `202 Accepted`. The ordering this gate
 * protects is settled by then, so releasing is safe.
 */
export const MAX_HOLD_MS =
  AUTH_INIT_TIMEOUT_MS +
  2 * FETCH_RESPONSE_HEADERS_TIMEOUT_MS +
  REMINT_BUDGET_MS +
  SEND_PRELUDE_BUDGET_MS

/**
 * Counts the messages currently on their way to the server: held from entry to
 * useAgentSession.sendMessage until the POST that carries the message has
 * settled.
 *
 * NOT from the send click, and the gap is not nothing.
 * useAgentDraftSubmission.submit clears the draft before it calls `send`, so
 * anything AgentPanelRoot awaits in between runs with the composer already
 * looking sent and no hold taken — on main that is the first-message consent
 * check and the coach tour it waits on. A mode picked inside that window still
 * precedes the POST. It is one consent round trip on an account's first
 * message; closing it means taking the hold at startSubmission and passing the
 * release through.
 *
 * It exists because that window is not visible anywhere else. The composer's
 * submission looks like it, but New Chat and switching threads both clear it
 * (agentComposerStore.invalidateSubmission) while the POST is still in flight —
 * and neither cancels the turn. The POST keeps running server-side and keeps
 * spending; what is discarded is the client's view of it, since
 * stashActiveTurn() has no slot to stash before the ack and performSend's
 * generation check drops the late one. Anything that must not overtake a sent
 * message has to track the request, not the draft it came from (PM-1660).
 *
 * It orders writes from THIS page only. The server resolves run mode per
 * user, so a second tab's write is ordered against its own sends and can
 * still overtake this one's — closing that needs the ordering point to move
 * to the server, which is where the mode is pinned.
 *
 * And a hold ends on ANY settle, including a client-side abort: a headers
 * timeout or a network error releases it, which does not prove the server
 * discarded a request it may already have queued. Unresolved deliberately —
 * it turns on whether cloud cancels on client disconnect, which needs an
 * experiment against the service rather than a reading of this file, and
 * holding on every ambiguous failure would change behaviour for every failed
 * send.
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
