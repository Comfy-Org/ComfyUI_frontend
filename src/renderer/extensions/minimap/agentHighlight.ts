/** Scale-up and halo of the entry animation. */
const POP_MS = 260
/** Full-strength hold once the node has landed. */
const HOLD_MS = 4000
/** Ease back to the node's ordinary fill. */
const FADE_MS = 1800

export const AGENT_HIGHLIGHT_LIFETIME_MS = HOLD_MS + FADE_MS

export interface AgentHighlight {
  /** 0 the instant the node lands, 1 once it has finished popping in. */
  readonly pop: number
  /** Opacity of the agent fill: 1 while held, easing to 0 as the mark expires. */
  readonly strength: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * The agent treatment for a node created at `generatedAt`, or null once the
 * mark has expired and the node draws like any other.
 */
export function agentHighlightAt(
  generatedAt: number,
  now: number
): AgentHighlight | null {
  const age = now - generatedAt
  if (age >= AGENT_HIGHLIGHT_LIFETIME_MS) return null

  return {
    pop: easeOutCubic(clamp01(age / POP_MS)),
    strength: 1 - clamp01((age - HOLD_MS) / FADE_MS)
  }
}
