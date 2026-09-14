/** Scale-up and halo of the entry animation. */
export const AGENT_POP_MS = 260

export interface AgentHighlight {
  /** 0 the instant the node lands, 1 once it has finished popping in. */
  readonly pop: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * The agent treatment for a node created at `generatedAt`. The mark is
 * provenance, not recency: it holds for as long as the node exists, so this
 * only ever describes where the node is in its entry animation.
 */
export function agentHighlightAt(
  generatedAt: number,
  now: number
): AgentHighlight {
  return { pop: easeOutCubic(clamp01((now - generatedAt) / AGENT_POP_MS)) }
}
