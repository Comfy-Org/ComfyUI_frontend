import type { FieldErrors } from './workshop-playground'
import type { Modality, ModelStatus } from './workshop'

export const OUTPUT_TTL_MS = 24 * 60 * 60 * 1000

export type RunFailure =
  | 'validation'
  | 'provider'
  | 'rateLimit'
  | 'policy'
  | 'noCredits'
  | 'unavailable'
  | 'timeout'

export interface RunOutput {
  readonly kind: Modality | 'other'
  readonly url: string
  readonly text?: string
  readonly urls?: readonly string[]
  readonly fileName: string
  // Kept on the output itself so earlier runs stay gated once the run state moves on.
  readonly nsfw?: boolean
}

export type RunState =
  | { readonly status: 'idle' }
  | { readonly status: 'example'; readonly output: RunOutput }
  | { readonly status: 'running'; readonly startedAt: number }
  | { readonly status: 'cancelled' }
  | {
      readonly status: 'succeeded'
      readonly output: RunOutput
      readonly creditsUsed: number
      readonly completedAt: number
      readonly expiresAt: number
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
      readonly creditsUsed: number
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
            creditsUsed: event.creditsUsed,
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

export type RunGate =
  | 'signedOut'
  | 'noCredits'
  | 'memberNoCredits'
  | 'policy'
  | 'unavailable'
  | 'ready'

export interface GateInput {
  readonly signedIn: boolean
  readonly credits: number
  readonly creditsPerRun: number
  readonly modelStatus?: ModelStatus
  readonly policyDisabled: boolean
  readonly unavailable: boolean
  readonly role?: 'owner' | 'member'
}

// Order matters: sign-in is asked before anything the account could fix,
// and a workspace policy block wins over credits because buying would not
// unblock the run.
export function runGate(input: GateInput): RunGate {
  if (input.unavailable || input.modelStatus === 'deprecated') {
    return 'unavailable'
  }
  if (!input.signedIn) return 'signedOut'
  if (input.policyDisabled) return 'policy'
  if (input.credits < input.creditsPerRun) {
    return input.role === 'member' ? 'memberNoCredits' : 'noCredits'
  }
  return 'ready'
}

export function isExpired(state: RunState, now: number): boolean {
  return state.status === 'succeeded' && now >= state.expiresAt
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
