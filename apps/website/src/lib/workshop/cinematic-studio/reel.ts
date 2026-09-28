import type { RunFailure, RunOutput } from '../../../config/workshop-run'
import type { AspectRatio } from './catalog'

interface TakeBase {
  readonly id: string
  readonly shot: number
  readonly letter: string
  readonly prompt: string
  readonly modelSlug: string
  readonly aspect: AspectRatio
  readonly startedAt: number
  readonly preview?: string
}

export type Take =
  | (TakeBase & { readonly status: 'rendering' })
  | (TakeBase & { readonly status: 'done'; readonly output: RunOutput })
  | (TakeBase & {
      readonly status: 'failed'
      readonly reason: RunFailure
      readonly requestId?: string
    })
  | (TakeBase & { readonly status: 'cancelled' })

export interface Reel {
  readonly takes: readonly Take[]
  readonly selectedId?: string
}

export type ReelEvent =
  | {
      readonly type: 'shotStarted'
      readonly ids: readonly string[]
      readonly prompt: string
      readonly modelSlug: string
      readonly aspect: AspectRatio
      readonly startedAt: number
      readonly preview?: string
    }
  | {
      readonly type: 'takeSucceeded'
      readonly id: string
      readonly output: RunOutput
    }
  | {
      readonly type: 'takeFailed'
      readonly id: string
      readonly reason: RunFailure
      readonly requestId?: string
    }
  | { readonly type: 'rendersCancelled' }
  | {
      readonly type: 'takeRetried'
      readonly id: string
      readonly startedAt: number
    }
  | { readonly type: 'selected'; readonly id: string }

export const EMPTY_REEL: Reel = { takes: [] }

const LETTERS = 'ABCDEFGH'

function nextShotNumber(reel: Reel): number {
  return reel.takes.reduce((max, take) => Math.max(max, take.shot), 0) + 1
}

function settle(
  reel: Reel,
  id: string,
  settleTake: (take: Take) => Take
): Reel {
  return {
    ...reel,
    takes: reel.takes.map((take) =>
      take.id === id && take.status === 'rendering' ? settleTake(take) : take
    )
  }
}

function restart(take: Take, startedAt: number): Take {
  const { id, shot, letter, prompt, modelSlug, aspect, preview } = take
  return {
    id,
    shot,
    letter,
    prompt,
    modelSlug,
    aspect,
    preview,
    startedAt,
    status: 'rendering'
  }
}

export function reduceReel(reel: Reel, event: ReelEvent): Reel {
  switch (event.type) {
    case 'shotStarted': {
      const shot = nextShotNumber(reel)
      const added: Take[] = event.ids.map((id, index) => ({
        id,
        shot,
        letter: LETTERS[index],
        prompt: event.prompt,
        modelSlug: event.modelSlug,
        aspect: event.aspect,
        startedAt: event.startedAt,
        preview: event.preview,
        status: 'rendering'
      }))
      return { takes: [...reel.takes, ...added], selectedId: added[0]?.id }
    }
    case 'takeSucceeded':
      return settle(reel, event.id, (take) => ({
        ...take,
        status: 'done',
        output: event.output
      }))
    case 'takeFailed':
      return settle(reel, event.id, (take) => ({
        ...take,
        status: 'failed',
        reason: event.reason,
        requestId: event.requestId
      }))
    case 'rendersCancelled':
      return {
        ...reel,
        takes: reel.takes.map((take) =>
          take.status === 'rendering' ? { ...take, status: 'cancelled' } : take
        )
      }
    case 'takeRetried':
      return {
        takes: reel.takes.map((take) =>
          take.id === event.id &&
          (take.status === 'failed' || take.status === 'cancelled')
            ? restart(take, event.startedAt)
            : take
        ),
        selectedId: event.id
      }
    case 'selected':
      return reel.takes.some((take) => take.id === event.id)
        ? { ...reel, selectedId: event.id }
        : reel
  }
}

export function selectedTake(reel: Reel): Take | undefined {
  return (
    reel.takes.find((take) => take.id === reel.selectedId) ??
    reel.takes[reel.takes.length - 1]
  )
}

export function takesOfShot(reel: Reel, shot: number): readonly Take[] {
  return reel.takes.filter((take) => take.shot === shot)
}

export function isRendering(reel: Reel): boolean {
  return reel.takes.some((take) => take.status === 'rendering')
}

export type TakeKind =
  | 'done'
  | 'rendering'
  | 'cancelled'
  | 'unpaid'
  | 'blocked'
  | 'failed'

/** How a take reads at a glance: its status, with failures sorted by cause. */
export function takeKind(take: Take): TakeKind {
  if (take.status !== 'failed') return take.status
  if (take.reason === 'noCredits') return 'unpaid'
  if (take.reason === 'policy' || take.reason === 'validation') return 'blocked'
  return 'failed'
}

/** A take the Router refused because the balance could not pay for it. */
export function isUnpaid(take: Take): boolean {
  return takeKind(take) === 'unpaid'
}
