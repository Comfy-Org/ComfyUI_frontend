import type { BillingStatus } from '@comfyorg/ingest-types'

export type BillingStatusBannerKind =
  | 'paused'
  | 'planEnded'
  | 'outOfCredits'
  | 'ending'
  | 'planChange'

export type BillingStatusBannerAudience = 'team' | 'personal'

export type EnterpriseEndingNotice = 'scheduled' | 'started'

export interface BillingStatusBannerFacts {
  billingControlEnabled: boolean
  audience: BillingStatusBannerAudience | null
  enterpriseEndingNotice: EnterpriseEndingNotice | null
  isLoaded: boolean
  billingStatus: BillingStatus | null
  canAccessSubscriptionFeatures: boolean
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  isPlanEnded: boolean
  isPlanTerminal: boolean
  planEndedDismissed: boolean
  outOfCreditsDismissed: boolean
  planChangeDismissed: boolean
  hasScheduledChange: boolean
  topUpDeniedPastDue: boolean
  runDeniedPastDue: boolean
  unifiedBillingSettingsEnabled: boolean
  isActive: boolean
}

function deriveEnterpriseBanner(
  facts: BillingStatusBannerFacts
): BillingStatusBannerKind | null {
  if (!facts.canAccessSubscriptionFeatures) return null
  if (!facts.billingControlEnabled) return null
  return facts.enterpriseEndingNotice === 'started' ? 'ending' : null
}

function deriveLifecycleNotice(
  facts: BillingStatusBannerFacts,
  audience: BillingStatusBannerAudience
): BillingStatusBannerKind | null {
  if (facts.isCancelled && facts.endDate) return 'ending'
  const showsPlanChange =
    audience === 'team' &&
    facts.hasScheduledChange &&
    !facts.isCancelled &&
    facts.canManage &&
    !facts.planChangeDismissed
  return showsPlanChange ? 'planChange' : null
}

function showsPastDueOutOfCredits(facts: BillingStatusBannerFacts): boolean {
  return (
    (facts.topUpDeniedPastDue || facts.runDeniedPastDue) &&
    facts.hasFunds === false &&
    !facts.outOfCreditsDismissed
  )
}

function cloudCreditBannersOpen(facts: BillingStatusBannerFacts): boolean {
  if (!facts.unifiedBillingSettingsEnabled) return true
  return facts.isActive
}

function deriveNoticeBanner(
  facts: BillingStatusBannerFacts,
  audience: BillingStatusBannerAudience
): BillingStatusBannerKind | null {
  if (!facts.billingControlEnabled) return null
  const creditsOpen = cloudCreditBannersOpen(facts)
  if (creditsOpen && showsPastDueOutOfCredits(facts)) return 'outOfCredits'
  if (!facts.canAccessSubscriptionFeatures) return null
  if (creditsOpen && facts.hasFunds === false && !facts.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  return deriveLifecycleNotice(facts, audience)
}

function hasPlanEnded(
  facts: BillingStatusBannerFacts,
  audience: BillingStatusBannerAudience | null
): boolean {
  return facts.isPlanEnded || (audience === 'personal' && facts.isPlanTerminal)
}

/** The one billing status banner for the served billing status, plan lifecycle and credit facts. */
export function deriveBillingStatusBanner(
  facts: BillingStatusBannerFacts
): BillingStatusBannerKind | null {
  if (facts.billingStatus === 'paused') return 'paused'
  if (!facts.isLoaded) return null
  const { audience } = facts
  if (hasPlanEnded(facts, audience)) {
    return facts.planEndedDismissed ? null : 'planEnded'
  }
  if (facts.enterpriseEndingNotice) return deriveEnterpriseBanner(facts)
  return audience ? deriveNoticeBanner(facts, audience) : null
}
