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

/**
 * Whether agent requests carry the signed-in Comfy account's credential. The
 * local agent makes its model and CLI calls as that account, so sending needs
 * a credential and a running turn re-sends it before it expires.
 */
export function forwardsComfyCredential(): boolean {
  return isAgentStandalone()
}

/**
 * Where the consent decision lives: on the Comfy account and team workspace
 * (cloud, which needs sign-in first), or on this device (the local agent has
 * no account or workspace to scope it to).
 */
export function agentConsentScope(): 'account' | 'device' {
  return isAgentStandalone() ? 'device' : 'account'
}
