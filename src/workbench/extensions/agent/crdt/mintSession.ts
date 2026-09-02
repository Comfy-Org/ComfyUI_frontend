/**
 * Shared mint scopes: ONE teardown bracket for all ports (a port missing a
 * bracket call is a mint storm), and a synchronous remote-apply flag for the
 * actor-less link/widget stores (layout keeps actor stamping instead).
 */
export interface MintSession {
  beginGraphTeardown(): void
  endGraphTeardown(): void
  inTeardown(): boolean
  runRemoteApply<T>(fn: () => T): T
  inRemoteApply(): boolean
}

export function createMintSession(): MintSession {
  let teardownDepth = 0
  let remoteApplyDepth = 0

  return {
    beginGraphTeardown() {
      teardownDepth++
    },
    endGraphTeardown() {
      teardownDepth = Math.max(0, teardownDepth - 1)
    },
    inTeardown() {
      return teardownDepth > 0
    },
    runRemoteApply<T>(fn: () => T): T {
      remoteApplyDepth++
      try {
        const result = fn()
        if (
          result !== null &&
          typeof result === 'object' &&
          'then' in result &&
          typeof (result as { then: unknown }).then === 'function'
        ) {
          // The scope is synchronous by contract: any continuation after an
          // await runs OUTSIDE it, and remote echoes there would mint straight
          // into the bound doc. Surface the contract break loudly.
          console.error(
            '[agent-crdt] runRemoteApply received an async fn; continuations after the first await escape the remote scope'
          )
        }
        return result
      } finally {
        remoteApplyDepth--
      }
    },
    inRemoteApply() {
      return remoteApplyDepth > 0
    }
  }
}
