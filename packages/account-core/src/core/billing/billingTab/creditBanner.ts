import type { AutoTopUpBannerKind } from './autoTopUpBanner'
import { cloudCreditBannersAllowed } from './cloudCreditBanners'
import type { PlanRowFacts } from './planRow'

export type LocalCreditBannerKind =
  | 'outOfCredits'
  | AutoTopUpBannerKind
  | 'lowCredits'

export interface LocalCreditBannerInput {
  unifiedBillingSettingsEnabled: boolean
  isCloud: boolean
  isActive: boolean
  subscriptionState: PlanRowFacts['subscriptionState']
  hasFunds: boolean | null
  lowBalance: boolean | undefined
  outOfCreditsDismissed: boolean
  lowCreditsDismissed: boolean
  autoTopUp: AutoTopUpBannerKind | null
}

/** The credit banner: a served auto top-up banner first, then out of credits, then low credits, each until dismissed. */
export function deriveLocalCreditBanner(
  input: LocalCreditBannerInput
): LocalCreditBannerKind | null {
  if (!input.unifiedBillingSettingsEnabled) return null
  if (input.autoTopUp) return input.autoTopUp
  if (
    input.isCloud &&
    !cloudCreditBannersAllowed(input.subscriptionState, input.isActive)
  ) {
    return null
  }
  if (input.hasFunds === false && !input.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  if (input.lowBalance === true && !input.lowCreditsDismissed) {
    return 'lowCredits'
  }
  return null
}
