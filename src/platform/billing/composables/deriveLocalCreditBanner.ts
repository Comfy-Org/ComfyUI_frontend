export type LocalCreditBannerKind = 'outOfCredits' | 'lowCredits'

export interface LocalCreditBannerInput {
  unifiedBillingSettingsEnabled: boolean
  hasFunds: boolean | null
  lowBalance: boolean | undefined
  outOfCreditsDismissed: boolean
  lowCreditsDismissed: boolean
}

export function deriveLocalCreditBanner(
  input: LocalCreditBannerInput
): LocalCreditBannerKind | null {
  if (!input.unifiedBillingSettingsEnabled) return null
  if (input.hasFunds === false && !input.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  if (input.lowBalance === true && !input.lowCreditsDismissed) {
    return 'lowCredits'
  }
  return null
}
