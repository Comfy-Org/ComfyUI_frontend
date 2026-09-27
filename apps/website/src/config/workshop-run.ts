import type { FieldErrors } from './workshop-playground'
import type { Modality } from './models-catalogue'

export const OUTPUT_TTL_MS = 24 * 60 * 60 * 1000

export type RunFailure =
  | 'validation'
  | 'provider'
  | 'upload'
  | 'network'
  | 'response'
  | 'client'
  | 'concurrency'
  | 'conflict'
  | 'rateLimit'
  | 'policy'
  | 'noCredits'
  | 'unavailable'
  | 'timeout'

export interface RunOutput {
  readonly id?: string
  readonly kind: Modality | 'other'
  readonly purpose?: 'response-metadata'
  readonly url: string
  readonly download?: { readonly url: string; readonly expiresAt: number }
  readonly expiresAt?: number
  readonly byteLength?: number
  readonly text?: string
  readonly truncated?: boolean
  readonly urls?: readonly string[]
  readonly fileName: string
  // Kept on the output itself so earlier runs stay gated once the run state moves on.
  readonly nsfw?: boolean
}

/** One Router request, including any additional media and raw response. */
export interface RunRecord {
  readonly output: RunOutput
  readonly attachments: readonly RunOutput[]
}

export type RunState =
  | { readonly status: 'idle' }
  | { readonly status: 'example'; readonly output: RunOutput }
  | {
      readonly status: 'running'
      readonly startedAt: number
      readonly label?: string
    }
  | { readonly status: 'cancelled' }
  | {
      readonly status: 'succeeded'
      readonly output: RunOutput
      readonly completedAt: number
      readonly expiresAt?: number
      readonly nsfw: boolean
    }
  | {
      readonly status: 'failed'
      readonly reason: RunFailure
      readonly fieldErrors: FieldErrors
    }

export type RunEvent =
  | { readonly type: 'start'; readonly at: number }
  | { readonly type: 'cancel' }
  | {
      readonly type: 'complete'
      readonly at: number
      readonly output: RunOutput
      readonly nsfw: boolean
      readonly ttlMs?: number
    }
  | {
      readonly type: 'fail'
      readonly reason: RunFailure
      readonly fieldErrors?: FieldErrors
    }
  | { readonly type: 'reset' }

export const IDLE: RunState = { status: 'idle' }

export function transition(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'start':
      return state.status === 'running'
        ? state
        : { status: 'running', startedAt: event.at }
    case 'cancel':
      return state.status === 'running' ? { status: 'cancelled' } : state
    case 'complete':
      return state.status === 'running'
        ? {
            status: 'succeeded',
            output: event.output,
            completedAt: event.at,
            expiresAt: event.at + (event.ttlMs ?? OUTPUT_TTL_MS),
            nsfw: event.nsfw
          }
        : state
    case 'fail':
      return state.status === 'running' || event.reason === 'validation'
        ? {
            status: 'failed',
            reason: event.reason,
            fieldErrors: event.fieldErrors ?? {}
          }
        : state
    case 'reset':
      return IDLE
  }
}

export function isExpired(state: RunState, now: number): boolean {
  return (
    state.status === 'succeeded' &&
    state.expiresAt !== undefined &&
    now >= state.expiresAt
  )
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
