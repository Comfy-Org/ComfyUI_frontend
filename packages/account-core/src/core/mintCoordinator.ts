import type { MintHandle, SessionResult } from './sessionContracts.js'

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
