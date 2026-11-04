import type { AutoReloadSettings, AutoTopUpSetup } from '@comfyorg/ingest-types'

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

export type AutoTopUpSection =
  | { kind: 'card' }
  | { kind: 'memberBlock' }
  | { kind: 'hidden' }

export interface AutoTopUpSectionFacts {
  autoTopUpEnabled: boolean
  canManageAutoTopUp: boolean
  canTopUp: boolean
  manageAutoTopUpDenial: string | undefined
}

/** The card for an owner who can top up; the member block only for a served `not_workspace_owner` denial. */
export function deriveAutoTopUpSection(
  facts: AutoTopUpSectionFacts
): AutoTopUpSection {
  if (!facts.autoTopUpEnabled) return { kind: 'hidden' }
  if (facts.canManageAutoTopUp && facts.canTopUp) return { kind: 'card' }
  return facts.manageAutoTopUpDenial === 'not_workspace_owner'
    ? { kind: 'memberBlock' }
    : { kind: 'hidden' }
}

export type AutoTopUpOffView =
  | 'off'
  | 'noPaymentMethod'
  | 'noDefaultPaymentMethod'

export interface AutoTopUpOffViewFacts {
  setup: AutoTopUpSetup | null
  savedPaymentMethodCount: number | null
}

/** An off card frozen for a missing default asks for a card when none is saved, else for a default. */
export function autoTopUpOffView(
  facts: AutoTopUpOffViewFacts
): AutoTopUpOffView {
  const needsDefault =
    facts.setup?.state === 'frozen' &&
    facts.setup.reason === 'default_payment_method_missing'
  if (!needsDefault) return 'off'
  return facts.savedPaymentMethodCount === 0
    ? 'noPaymentMethod'
    : 'noDefaultPaymentMethod'
}
