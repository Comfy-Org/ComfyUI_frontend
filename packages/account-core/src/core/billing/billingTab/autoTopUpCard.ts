import type { AutoReloadSettings } from '@comfyorg/ingest-types'

export type AutoTopUpCardState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; settings: AutoReloadSettings }

export interface AutoTopUpCardFacts {
  isLoading: boolean
  settings: AutoReloadSettings | null
}

/** Served settings win over an in-flight refresh; no settings after a read is unavailable. */
export function deriveAutoTopUpCard(
  facts: AutoTopUpCardFacts
): AutoTopUpCardState {
  if (facts.settings) return { kind: 'loaded', settings: facts.settings }
  return facts.isLoading ? { kind: 'loading' } : { kind: 'unavailable' }
}
