import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import { studioGate } from '@/lib/workshop/cinematic-studio/gate'
import { failureNote } from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'

/** Waits before asking for the price again after a failed quote. */
const QUOTE_RETRY_MS = [5_000, 15_000, 30_000, 60_000]
/** Quote failures that waiting cannot fix: no such app, or signed out. */
const QUOTE_FINAL = new Set(['not_found', 'unauthorized', 'app_unavailable'])
const UNAVAILABLE = new Set(['app_unavailable', 'not_found'])

const codeOf = (error: unknown) =>
  error instanceof ReshootError ? error.code : ''

/** What the page knows about the visitor and the backend, for the Generate slot. */
export interface SwapGateFacts {
  /** `astro dev` only: the backend in use asks for no account. */
  readonly noAccount: boolean
  readonly unavailable: boolean
  readonly mounted: boolean
  readonly authEnabled: boolean
  readonly sessionFailed: boolean
  readonly sessionSettled: boolean
  readonly hasUser: boolean
  readonly hasSession: boolean
  readonly role?: 'owner' | 'member'
  /** The last quote refused the run for lack of credits. */
  readonly refusesCredit: boolean
}

/** What the Generate slot offers: the button, sign-in, or a reason it cannot run. */
export function swapGate(facts: SwapGateFacts): StudioGate {
  if (facts.noAccount && !facts.unavailable) {
    if (!facts.mounted) return 'pending'
    return facts.refusesCredit ? 'noCredits' : 'ready'
  }
  return studioGate({
    runEnabled: !facts.unavailable,
    modelRunnable: true,
    mounted: facts.mounted,
    authAvailable: facts.authEnabled && !facts.sessionFailed,
    sessionSettled:
      facts.sessionSettled && !(facts.hasUser && !facts.hasSession),
    role: facts.role,
    credits: facts.refusesCredit ? 0 : undefined
  })
}

/** A blocked quote for lack of credits, unless a take is already rendering. */
export const quoteRefusesCredit = (
  rendering: boolean,
  quote: ReshootQuote | undefined
) => !rendering && quote?.blocked_reason === 'insufficient_credits'

export type MissingInput = 'video' | 'character' | 'target'

/** What is still missing before Generate, in the order the panel asks. */
export function missingInput(inputs: {
  readonly video: boolean
  readonly character: boolean
  readonly target: string
}): MissingInput | undefined {
  if (!inputs.video) return 'video'
  if (!inputs.character) return 'character'
  return inputs.target.trim() ? undefined : 'target'
}

/** Whether Generate may start a run right now. */
export const canSwap = (state: {
  readonly gate: StudioGate
  readonly missing: MissingInput | undefined
  readonly rendering: boolean
  readonly quoteSettled: boolean
  readonly quote: ReshootQuote | undefined
}) =>
  state.gate === 'ready' &&
  state.missing === undefined &&
  !state.rendering &&
  state.quoteSettled &&
  state.quote?.next_run !== 'blocked'

/** What a failed quote means for the page, and whether to ask again. */
export function quoteFailure(
  error: unknown,
  failures: number
): { readonly unavailable: boolean; readonly retryInMs: number | undefined } {
  const code = codeOf(error)
  return {
    unavailable: UNAVAILABLE.has(code),
    retryInMs: QUOTE_FINAL.has(code)
      ? undefined
      : QUOTE_RETRY_MS[Math.min(failures, QUOTE_RETRY_MS.length - 1)]
  }
}

/** Who is told about a failed run, for the wording of its note. */
export interface SwapNoteContext {
  readonly locale: Locale
  readonly role?: 'owner' | 'member'
  readonly workspace?: string
  /** The price last quoted, for a free-runs-exhausted note. */
  readonly price?: number
}

/** Why a run did not finish, in the reader's words. */
export function swapFailureNote(
  error: unknown,
  context: SwapNoteContext
): string {
  const { t } = translationsFor(context.locale)
  const code = codeOf(error)
  if (code === 'insufficient_credits')
    return t(
      context.role === 'member'
        ? 'workshop.error.memberNoCredits'
        : 'workshop.error.noCreditsCloud',
      { workspace: context.workspace ?? '' }
    )
  if (UNAVAILABLE.has(code)) return t('openjutsu.unavailable')
  if (code === 'unauthorized') return t('openjutsu.signIn')
  if (code === 'job_failed') return t('openjutsu.error.swap')
  return failureNote(error, context.locale, context.price)
}

/** How a failed run is counted: the backend's refusal, or the page's own fault. */
export const swapFailureReason = (error: unknown) =>
  error instanceof ReshootError ? 'provider' : 'client'
