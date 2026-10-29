/**
 * The scoped localStorage flag the Agent onboarding tour writes when it is
 * finished or dismissed, for the user and workspace the cloud e2e mocks boot.
 * Scoping lives in `scopedOnboardingKey()`; this is that shape pinned to the
 * e2e identity, so a spec can seed the flag or watch it being set.
 */
export const AGENT_COACH_SEEN_KEY =
  'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'
