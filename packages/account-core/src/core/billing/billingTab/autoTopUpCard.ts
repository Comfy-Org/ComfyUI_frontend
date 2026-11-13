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
  canViewAutoTopUpCard: boolean
  canViewAutoTopUpMemberNotice: boolean
}

/** The card when `can_view_auto_top_up` is served true, else the member block when `can_view_auto_top_up_member_notice` is. */
export function deriveAutoTopUpSection(
  facts: AutoTopUpSectionFacts
): AutoTopUpSection {
  if (!facts.autoTopUpEnabled) return { kind: 'hidden' }
  if (facts.canViewAutoTopUpCard) return { kind: 'card' }
  return facts.canViewAutoTopUpMemberNotice
    ? { kind: 'memberBlock' }
    : { kind: 'hidden' }
}

export interface AutoTopUpSetupFacts {
  autoTopUpEnabled: boolean
  canManageAutoTopUp: boolean
  setup: AutoTopUpSetup | null
}

const PAUSED_PLAN_REASONS: ReadonlySet<AutoTopUpSetup['reason']> = new Set([
  'payment_past_due',
  'billing_paused'
])

/** Auto top-up is hidden on every surface while setup is unavailable or frozen for a paused plan. */
export function isAutoTopUpNotAvailable(setup: AutoTopUpSetup | null): boolean {
  if (setup === null) return false
  if (setup.state === 'unavailable') return true
  return setup.state === 'frozen' && PAUSED_PLAN_REASONS.has(setup.reason)
}

/** Platform Billing's Turn on block: served `auto_top_up_enabled` and `can_manage_auto_top_up`, and a served setup that is not Not available. */
export function canSetUpAutoTopUp(facts: AutoTopUpSetupFacts): boolean {
  if (!facts.autoTopUpEnabled || !facts.canManageAutoTopUp) return false
  return facts.setup !== null && !isAutoTopUpNotAvailable(facts.setup)
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
