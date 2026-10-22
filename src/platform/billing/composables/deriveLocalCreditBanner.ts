import type { AutoTopUpBannerKind } from '@/platform/billing/composables/deriveAutoTopUpBanner'

export type LocalCreditBannerKind =
  | 'outOfCredits'
  | AutoTopUpBannerKind
  | 'lowCredits'

export interface LocalCreditBannerInput {
  unifiedBillingSettingsEnabled: boolean
  hasFunds: boolean | null
  lowBalance: boolean | undefined
  outOfCreditsDismissed: boolean
  lowCreditsDismissed: boolean
  autoTopUp: AutoTopUpBannerKind | null
}

export function deriveLocalCreditBanner(
  input: LocalCreditBannerInput
): LocalCreditBannerKind | null {
  if (!input.unifiedBillingSettingsEnabled) return null
  if (input.autoTopUp) return input.autoTopUp
  if (input.hasFunds === false && !input.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  if (input.lowBalance === true && !input.lowCreditsDismissed) {
    return 'lowCredits'
  }
  return null
}
