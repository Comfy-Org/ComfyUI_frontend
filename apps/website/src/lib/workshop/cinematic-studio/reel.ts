import type { RunFailure, RunOutput } from '../../../config/workshop-run'
import type { CreationSettings } from './creations'
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
  readonly settings?: CreationSettings
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
      readonly settings?: CreationSettings
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
        settings: event.settings,
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
