import type { CoachStep, EntryPath } from './onboardingTours'

export const IDLE = { phase: 'idle' } as const

/**
 * One activation of a tour. The same tour can start, lose its trigger and start
 * again, so its name cannot tell a reply meant for this run apart from one that
 * outlived the run before it.
 */
export type RunId = number & { readonly __brand: 'RunId' }

/**
 * `entering` is separate from `showing` because `onEnter` runs between them.
 *
 * `committed` is separate from `resolving` because a tour is decided on before
 * it is asked for: its definition is registered and its intro preview already
 * owns the canvas while nothing of it is on screen. Without a phase for that
 * window the only record of the decision is a local variable inside whoever
 * made it, and every observer that asks "is a tour running" is told no over a
 * screen the tour already has.
 */
export type TourState =
  | typeof IDLE
  | { phase: 'committed'; tour: EntryPath; run: RunId }
  | { phase: 'resolving'; tour: EntryPath; run: RunId }
  | {
      phase: 'waiting'
      tour: EntryPath
      run: RunId
      steps: CoachStep[]
      fromIdx: number | null
    }
  | {
      phase: 'entering'
      tour: EntryPath
      run: RunId
      steps: CoachStep[]
      fromIdx: number | null
      toIdx: number
    }
  | {
      phase: 'showing'
      tour: EntryPath
      run: RunId
      steps: CoachStep[]
      idx: number
    }

type RunningState = Extract<
  TourState,
  { phase: 'waiting' | 'entering' | 'showing' }
>

export function isRunning(state: TourState): state is RunningState {
  return (
    state.phase === 'waiting' ||
    state.phase === 'entering' ||
    state.phase === 'showing'
  )
}

/** `fromIdx === null` means nothing is on screen yet, so nothing to travel. */
export function shownIdx(state: TourState): number | null {
  if (state.phase === 'showing') return state.idx
  if (state.phase === 'entering')
    return state.fromIdx === null ? null : state.toIdx
  if (state.phase === 'waiting') return state.fromIdx
  return null
}

/** Events answering an `await` name their run, so a late reply can be refused. */
export type TourEvent =
  | { type: 'committed'; tour: EntryPath; run: RunId }
  | { type: 'released'; run: RunId }
  | { type: 'requested'; tour: EntryPath; run: RunId }
  | { type: 'resolved'; run: RunId; steps: CoachStep[] }
  | { type: 'resolvedEmpty'; run: RunId }
  | { type: 'targetAwaited'; run: RunId; fromIdx: number | null }
  | { type: 'stepEntering'; run: RunId; toIdx: number }
  | { type: 'stepShown'; run: RunId; idx: number }
  | { type: 'ended'; run: RunId }

type LiveState = Exclude<TourState, typeof IDLE>
type LiveEvent = Exclude<
  TourEvent,
  { type: 'committed' } | { type: 'requested' }
>

function commitTour(
  state: TourState,
  event: Extract<TourEvent, { type: 'committed' }>
): TourState {
  return state.phase === 'idle'
    ? { phase: 'committed', tour: event.tour, run: event.run }
    : state
}

function requestTour(
  state: TourState,
  event: Extract<TourEvent, { type: 'requested' }>
): TourState {
  if (state.phase === 'idle')
    return { phase: 'resolving', tour: event.tour, run: event.run }
  return state.phase === 'committed' &&
    state.tour === event.tour &&
    state.run === event.run
    ? { phase: 'resolving', tour: event.tour, run: event.run }
    : state
}

function transitionLiveTour(state: LiveState, event: LiveEvent): TourState {
  switch (event.type) {
    case 'released':
      return state.phase === 'committed' ? IDLE : state
    case 'resolved':
      return state.phase === 'resolving'
        ? {
            phase: 'entering',
            tour: state.tour,
            run: state.run,
            steps: event.steps,
            fromIdx: null,
            toIdx: 0
          }
        : state
    case 'resolvedEmpty':
      return state.phase === 'resolving' ? IDLE : state
    case 'targetAwaited':
      return isRunning(state)
        ? {
            phase: 'waiting',
            tour: state.tour,
            run: state.run,
            steps: state.steps,
            fromIdx: event.fromIdx
          }
        : state
    case 'stepEntering':
      return isRunning(state)
        ? {
            phase: 'entering',
            tour: state.tour,
            run: state.run,
            steps: state.steps,
            fromIdx: shownIdx(state),
            toIdx: event.toIdx
          }
        : state
    case 'stepShown':
      return state.phase === 'entering'
        ? {
            phase: 'showing',
            tour: state.tour,
            run: state.run,
            steps: state.steps,
            idx: event.idx
          }
        : state
    case 'ended':
      return state.phase === 'committed' ? state : IDLE
  }
}

export function reduceTour(state: TourState, event: TourEvent): TourState {
  if (event.type === 'committed') return commitTour(state, event)
  if (event.type === 'requested') return requestTour(state, event)
  if (state.phase === 'idle' || state.run !== event.run) return state
  return transitionLiveTour(state, event)
}
