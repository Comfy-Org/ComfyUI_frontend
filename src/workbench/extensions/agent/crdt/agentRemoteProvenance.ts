/**
 * Which remote-apply scope a write belongs to, for listeners that need more
 * than `source === 'agent-remote'`.
 *
 * Every frame the projection applies reaches the graph as `agent-remote`,
 * including the host baseline, a catch-up replay after reconnect, a frame
 * another tab's `human:*` actor authored, the rollback of a rejected human
 * edit (`agent:revert`) and the collected-while-detached batch. Only a live
 * Agent turn is a write the Agent made. `RemoteApplyContext.liveAgentTurn`
 * already carries that distinction (`isLiveAgentUpdate`), so it is scoped
 * here rather than re-derived from the actor string.
 *
 * Provenance rides on the call for the duration of the apply (KEEP-ALIVE
 * #14), the same shape as `withGraphIntentSource`. It is deliberately
 * private to the agent extension: no shared layer reads it.
 */
let liveAgentTurn = false

/** Runs `fn` with the live-Agent-turn flag set for every write it raises. */
export function withLiveAgentTurnWrites<T>(
  { isLiveAgentTurn }: { isLiveAgentTurn: boolean },
  fn: () => T
): T {
  const previous = liveAgentTurn
  liveAgentTurn = isLiveAgentTurn
  try {
    return fn()
  } finally {
    liveAgentTurn = previous
  }
}

/** True while a live Agent turn's frame is being applied to the graph. */
export function isLiveAgentTurnWrite(): boolean {
  return liveAgentTurn
}
