import type { SwapSize, SwapWindow } from './clip'
import type { SwapPhase } from './run-swap'

/** One run and what came of it. */
export interface SwapTake {
  readonly id: string
  readonly n: number
  /** Who was replaced, as typed. */
  readonly target: string
  readonly window: SwapWindow
  /** Seconds of result asked for. */
  readonly seconds: number
  readonly size: SwapSize
  readonly seed: number
  readonly status: 'rendering' | 'done' | 'cancelled' | 'failed'
  readonly phase?: SwapPhase
  readonly url?: string
  readonly note?: string
}

/** Which of a finished take's two videos the player shows. */
export type StageCompare = 'result' | 'source'

/** What the stage is showing: the clip being set up, or one take. */
export interface StageView {
  readonly current: SwapTake | undefined
  readonly compare: StageCompare
  /** The clip in use. */
  readonly videoUrl: string | undefined
  /** The part chosen in the trim dialog, and the seconds a run gives back. */
  readonly range: SwapWindow | undefined
  readonly partSeconds: number | undefined
}

const showsResult = (view: StageView) =>
  view.current?.url !== undefined && view.compare === 'result'

/** The video the player plays: a take's result, or the clip it came from. */
export const stageSource = (view: StageView) =>
  showsResult(view) ? view.current?.url : view.videoUrl

function editingWindow(view: StageView): SwapWindow | undefined {
  return view.range && view.partSeconds !== undefined
    ? { start: view.range.start, seconds: view.partSeconds }
    : undefined
}

/**
 * The part of the clip the player loops: the trim while setting up, a take's
 * own part when its source is shown, and nothing for a result, which plays
 * whole.
 */
export function loopWindow(view: StageView): SwapWindow | undefined {
  if (!view.current) return editingWindow(view)
  return showsResult(view)
    ? undefined
    : { start: view.current.window.start, seconds: view.current.seconds }
}

/** Where to send a player that has wandered outside its part; undefined if it has not. */
export function loopSeek(
  currentTime: number,
  bounds: SwapWindow | undefined
): number | undefined {
  if (!bounds) return undefined
  const outside =
    currentTime < bounds.start - 0.05 ||
    currentTime >= bounds.start + bounds.seconds
  return outside ? bounds.start : undefined
}

/** What sits over the player for a take: its progress, or why it stopped. */
export function takeOverlay(
  take: SwapTake | undefined
): 'progress' | 'stopped' | undefined {
  if (take?.status === 'rendering') return 'progress'
  return take?.status === 'failed' || take?.status === 'cancelled'
    ? 'stopped'
    : undefined
}

/** What the stage shows under the player. */
export function stagePanel(
  view: Pick<StageView, 'current' | 'range' | 'partSeconds'> & {
    readonly clipSeconds: number | undefined
  }
): 'part' | 'result' | undefined {
  if (!view.current)
    return view.range &&
      view.partSeconds !== undefined &&
      view.clipSeconds !== undefined
      ? 'part'
      : undefined
  return view.current.status === 'done' && view.current.url
    ? 'result'
    : undefined
}

/** Why a stopped take stopped: its own note, or the stock line for how it ended. */
export function stoppedNote(
  take: Pick<SwapTake, 'status' | 'note'>,
  stock: { readonly cancelled: string; readonly failed: string }
): string {
  if (take.status === 'cancelled') return stock.cancelled
  return take.note ?? stock.failed
}
