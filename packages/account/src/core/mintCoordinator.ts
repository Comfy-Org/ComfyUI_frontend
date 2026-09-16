import type {
  AccountCredential,
  MintHandle,
  SessionResult
} from './sessionContracts.js'

export const DEFAULT_FRESH_MARGIN_MS = 5 * 60 * 1000

export function isCredentialFresh(
  session: AccountCredential,
  now: number,
  freshMarginMs: number = DEFAULT_FRESH_MARGIN_MS
): boolean {
  return session.expiresAt - now > freshMarginMs
}

interface CredentialCandidate {
  readonly credential: AccountCredential | undefined
  readonly target: string | undefined
}

/**
 * The live credential is authoritative; storage is recovery state, not a
 * competing source. Candidates are consulted in the order given (memory
 * first, then storage) for this exact uid and target, and the first fresh one
 * wins — expiry must not override this (a rejected token can outlive its
 * shorter-lived replacement), and a target-less read must never adopt a team
 * session.
 */
export function selectFreshCredential(
  candidates: readonly (CredentialCandidate | undefined)[],
  uid: string,
  target: string | undefined,
  now: number,
  freshMarginMs: number
): AccountCredential | undefined {
  return candidates
    .map((candidate) =>
      candidate?.credential?.uid === uid && candidate.target === target
        ? candidate.credential
        : undefined
    )
    .find(
      (candidate): candidate is AccountCredential =>
        candidate !== undefined &&
        isCredentialFresh(candidate, now, freshMarginMs)
    )
}

// `joined` marks a caller that awaits another owner's in-flight mint rather
// than starting or cache-serving its own, so it can defer to that owner's
// commit instead of re-running the publication path.
export type MintDispatch = MintHandle & { readonly joined: boolean }

export interface InFlightMint {
  readonly promise: Promise<SessionResult>
  readonly uid: string
  readonly target: string | undefined
  readonly forced: boolean
  readonly mintId: number
}

export function canJoin(
  inFlight: InFlightMint | undefined,
  uid: string,
  target: string | undefined,
  forced: boolean
): inFlight is InFlightMint {
  return (
    inFlight !== undefined &&
    inFlight.uid === uid &&
    inFlight.target === target &&
    (!forced || inFlight.forced)
  )
}

interface MintCoordinator {
  dispatch: (
    uid: string,
    target: string | undefined,
    forced: boolean,
    start: () => MintHandle
  ) => MintDispatch
  abandon: () => void
}

export function createMintCoordinator(): MintCoordinator {
  let inFlight: InFlightMint | undefined

  return {
    dispatch(uid, target, forced, start) {
      if (canJoin(inFlight, uid, target, forced)) {
        return {
          mintId: inFlight.mintId,
          response: inFlight.promise,
          joined: true
        }
      }
      const { mintId, response } = start()
      const running = response.finally(() => {
        if (inFlight?.promise !== running) return
        inFlight = undefined
      })
      inFlight = { promise: running, uid, target, forced, mintId }
      return { mintId, response: running, joined: false }
    },
    abandon() {
      inFlight = undefined
    }
  }
}
