/**
 * The agent panel's one distribution boundary: the cloud product, or the local
 * agent harness (a `VITE_AGENT_STANDALONE` build). Callers ask for a policy
 * here instead of reading the environment, so the differences between the two
 * stay in one place.
 *
 * The literal `import.meta.env` comparison below is what Vite replaces at build
 * time, so every branch a policy guards folds to a constant and the unused side
 * is dead-code-eliminated. Keep it a literal comparison.
 */
export function isAgentStandalone(): boolean {
  return import.meta.env.VITE_AGENT_STANDALONE === 'true'
}
