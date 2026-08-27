/**
 * Shared mint-scope state for every mint port (plan 3.3). Two scopes:
 *
 * - Teardown brackets: workflow load/switch/close drives mass store writes
 *   (clears, link registration storms, widget restoration) with no
 *   call-carried provenance. The load path holds `beginGraphTeardown`/
 *   `endGraphTeardown` around every graph load, and every port treats the
 *   open bracket as non-mintable. One shared depth, not one per port: a port
 *   missing a bracket call is a mint storm, so the bracket is held once here.
 *
 * - Remote-apply scope: the follower's mutator drives litegraph synchronously,
 *   and litegraph writes `linkStore`/`widgetValueStore` synchronously in the
 *   same call graph. Those stores carry no actor, so echo suppression for
 *   their ports is this synchronous scope flag. (`layoutStore` is different:
 *   it stamps `operation.actor` at apply time and delivers changes on a
 *   microtask, so its port reads the actor instead - the composition root
 *   wraps the mutator in BOTH this scope and `layoutStore.withActor`.)
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
