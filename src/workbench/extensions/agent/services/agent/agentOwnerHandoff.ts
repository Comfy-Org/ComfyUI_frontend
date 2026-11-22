import { peekLastAgentCredential } from './agentAuth'

/**
 * Mailbox for the credential an account switch is leaving behind.
 *
 * `services/agent/local/internal/server/authority.go`'s `HandOff` moves the
 * local agent's owner from one Comfy account to another only when the
 * request carries both the new account's credential (the normal auth header)
 * and, in the body, the previous owner's credential. By the time a request
 * refused with `credential_not_owner` runs, the switch that caused it has
 * already overwritten every other place the previous credential lived, so it
 * has to be captured at switch time and held here until the first refusal
 * claims it - see `captureOutgoingCredentialForHandoff` for the write side
 * (wired to `AgentPanelRoot.vue`'s identity-change signal) and
 * `agentRestClient.ts`'s `requestResult` for the read side.
 *
 * `take...` deliberately clears the mailbox so two refusals racing the same
 * switch cannot both attempt a handoff with the same already-spent
 * credential; only the first gets the automatic retry, and the rest surface
 * their original refusal.
 */
let pendingPreviousCredential: string | null = null

export function rememberPreviousCredentialForHandoff(
  credential: string | null
): void {
  pendingPreviousCredential = credential
}

export function takePendingPreviousCredential(): string | null {
  const credential = pendingPreviousCredential
  pendingPreviousCredential = null
  return credential
}

/**
 * Snapshots whatever credential the outgoing account last used, so a
 * following `credential_not_owner` refusal can hand off to the new one. Call
 * once an identity change is observed (`AgentPanelRoot.vue`'s
 * `onIdentityChange`) - `peekLastAgentCredential` holds the outgoing
 * account's value until the next successful request overwrites it.
 */
export function captureOutgoingCredentialForHandoff(): void {
  rememberPreviousCredentialForHandoff(peekLastAgentCredential())
}
