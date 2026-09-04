export interface MintSession {
  beginGraphTeardown(): void
  endGraphTeardown(): void
  inTeardown(): boolean
}

export function createMintSession(): MintSession {
  let teardownDepth = 0

  return {
    beginGraphTeardown() {
      teardownDepth++
    },
    endGraphTeardown() {
      teardownDepth = Math.max(0, teardownDepth - 1)
    },
    inTeardown() {
      return teardownDepth > 0
    }
  }
}
