/**
 * Storybook mock for `useFeatureFlags`.
 *
 * The real composable resolves flags from authenticated remote config, which is
 * unavailable in Storybook. This stub enables billing controls and the OAuth consent account switcher.
 */
export function useFeatureFlags() {
  return {
    flags: {
      billingControlEnabled: true,
      hostedBillingDestination: 'stripe',
      hostedBillingWebEnabled: false,
      oauthConsentSwitchAccountEnabled: true,
      v1PaymentRecovery: true
    }
  }
}
