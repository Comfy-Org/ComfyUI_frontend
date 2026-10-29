/**
 * Storybook stand-in for `useFeatureFlags`, with billing controls and the
 * local engine menu on.
 */
export function useFeatureFlags() {
  return {
    flags: {
      billingControlEnabled: true,
      hostedBillingDestination: 'stripe',
      hostedBillingWebEnabled: false,
      openOnCloudEnabled: true,
      v1PaymentRecovery: true
    }
  }
}
