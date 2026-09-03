/**
 * The mint gate (plan 3.3): every human-edit mint hook is a no-op unless ALL
 * four conjuncts hold. Teardown is a first-class case — workflow load/switch/
 * close drives `clearGraph` and plural delete paths with no call-carried
 * provenance, and an ungated hook would mint a clear storm into the bound
 * doc on an ordinary tab switch.
 */
export interface MintGateInput {
  /** Slice 00's product gate (`agent-in-app-experience` via the panel store). */
  flagEnabled: boolean
  /** A semantic doc is bound for the active workflow. */
  docBound: boolean
  /** The mutation originates from a LOCAL human edit (not agent-remote, not load-driven). */
  localProvenance: boolean
  /** The mutation is graph teardown (workflow load/switch/close clearing). */
  teardown: boolean
}

export function shouldMint(input: MintGateInput): boolean {
  return (
    input.flagEnabled &&
    input.docBound &&
    input.localProvenance &&
    !input.teardown
  )
}
