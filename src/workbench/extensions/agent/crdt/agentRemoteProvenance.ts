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
