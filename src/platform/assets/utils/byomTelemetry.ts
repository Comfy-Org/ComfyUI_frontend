import type { ByomErrorReason } from '@/platform/telemetry/types'

/**
 * Mints the correlation id that ties one bring-your-own-model dialog session's
 * funnel events together. A user can open the wizard repeatedly, so without a
 * per-attempt id a funnel would stitch the first step of one attempt to the
 * last step of another, and three abandoned attempts would be
 * indistinguishable from one.
 */
export function createByomFlowId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `byom-${Math.random().toString(36).slice(2)}`
}

/**
 * Maps a caught upload/metadata error onto the closed `ByomErrorReason` set.
 *
 * The raw error is deliberately NOT emitted: `uploadError` is built from API
 * messages and from i18n strings that interpolate the asset name, so shipping
 * it verbatim would leak user-supplied text into analytics and give the
 * property unbounded cardinality.
 */
export function classifyByomError(
  stage: 'metadata' | 'upload'
): ByomErrorReason {
  return stage === 'metadata' ? 'metadata_fetch_failed' : 'download_failed'
}
